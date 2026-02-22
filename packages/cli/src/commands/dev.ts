import { spawn, ChildProcess } from "node:child_process";
import chokidar from "chokidar";
import path from "node:path";
import { ConsoleLogger } from "@trinacria/core";
import { ResolvedConfig } from "../config/config.contract";

const context = "TrinacriaCLI";
const log = new ConsoleLogger(context);
const RESTART_DEBOUNCE_MS = 100;
const STOP_TIMEOUT_MS = 3000;
const NON_RESTARTABLE_EXIT_CODES = new Set([78]);
let tsxCliEntryCache: string | null = null;

export async function dev(config: ResolvedConfig) {
  const entry = path.resolve(config.entry);
  const crashLoopWindowMs = config.crashLoopWindowMs;
  const maxConsecutiveCrashRestarts = config.maxConsecutiveCrashRestarts;

  log.info("Starting in dev mode", context);

  const watcher = chokidar.watch(config.watchDir, {
    ignoreInitial: true,
  });

  let restarting = false;
  let pendingRestart = false;
  let stopping = false;
  let crashCount = 0;
  let crashWindowStartedAt = 0;
  let restartTimeout: NodeJS.Timeout | null = null;

  const handleChildExit = (code: number | null) => {
    if (stopping || restarting) {
      return;
    }

    if (code !== 0) {
      if (code !== null && NON_RESTARTABLE_EXIT_CODES.has(code)) {
        log.error(
          `Application stopped with non-restartable exit code ${code}. Waiting for source changes...`,
          context,
        );
        return;
      }

      if (isCrashLoop()) {
        log.error(
          `Application crashed ${maxConsecutiveCrashRestarts} times in ${Math.floor(
            crashLoopWindowMs / 1000,
          )}s. Waiting for source changes...`,
          context,
        );
        return;
      }

      scheduleRestart(`App crashed (code ${code})`);
    }
  };

  const createTrackedChild = () => {
    const next = startApp(entry);
    next.on("exit", handleChildExit);
    next.on("error", (err) => {
      if (!stopping) {
        scheduleRestart(
          `App process failed to start: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    });
    return next;
  };

  let child = createTrackedChild();

  const scheduleRestart = (reason: string) => {
    if (restartTimeout) {
      clearTimeout(restartTimeout);
    }

    restartTimeout = setTimeout(() => {
      void restart(reason);
    }, RESTART_DEBOUNCE_MS);
  };

  const restart = async (reason: string) => {
    if (stopping) return;

    if (restarting) {
      pendingRestart = true;
      return;
    }

    restarting = true;

    try {
      do {
        pendingRestart = false;

        log.info(`${reason} — restarting application`, context);
        await stopChild(child);
        child = createTrackedChild();
      } while (pendingRestart);
    } finally {
      restarting = false;
    }
  };

  watcher.on("all", () => {
    crashCount = 0;
    crashWindowStartedAt = 0;
    scheduleRestart("Source changed");
  });

  const cleanup = async (signal: NodeJS.Signals) => {
    stopping = true;

    if (restartTimeout) {
      clearTimeout(restartTimeout);
      restartTimeout = null;
    }

    await watcher.close();
    await stopChild(child);
    process.exit(signal === "SIGINT" ? 130 : 143);
  };

  process.once("SIGINT", () => {
    void cleanup("SIGINT");
  });

  process.once("SIGTERM", () => {
    void cleanup("SIGTERM");
  });

  function isCrashLoop(): boolean {
    const now = Date.now();

    if (
      crashWindowStartedAt === 0 ||
      now - crashWindowStartedAt > crashLoopWindowMs
    ) {
      crashWindowStartedAt = now;
      crashCount = 1;
      return false;
    }

    crashCount += 1;
    return crashCount >= maxConsecutiveCrashRestarts;
  }
}

function startApp(entry: string): ChildProcess {
  return spawn(process.execPath, [resolveTsxCliPath(), entry], {
    stdio: "inherit",
  });
}

function resolveTsxCliPath(): string {
  if (tsxCliEntryCache) {
    return tsxCliEntryCache;
  }

  try {
    tsxCliEntryCache = require.resolve("tsx/cli");
    return tsxCliEntryCache;
  } catch (error) {
    throw new Error(
      `Unable to resolve tsx CLI entry. Ensure \"tsx\" is installed. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const forceKillTimer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
    }, STOP_TIMEOUT_MS);

    forceKillTimer.unref();

    child.once("exit", () => {
      clearTimeout(forceKillTimer);
      resolve();
    });

    child.kill("SIGTERM");
  });
}
