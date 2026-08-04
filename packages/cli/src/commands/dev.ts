import { type ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import { ConsoleLogger } from "@trinacria/core";
import chokidar from "chokidar";
import type { ResolvedConfig } from "../config/config.contract";

const context = "TrinacriaCLI";
const log = new ConsoleLogger(context);
const RESTART_DEBOUNCE_MS = 100;
const STOP_TIMEOUT_MS = 3000;
const NON_RESTARTABLE_EXIT_CODES = new Set([78]);
let tsxCliEntryCache: string | null = null;

interface DevDeps {
  watch: (watchDir: string) => {
    on(event: "all", listener: () => void): void;
    close(): Promise<void>;
  };
  startApp: (entry: string) => ChildProcess;
  stopChild: (child: ChildProcess) => Promise<void>;
  setTimeoutFn: typeof setTimeout;
  clearTimeoutFn: typeof clearTimeout;
  now: () => number;
  onSignal: (signal: NodeJS.Signals, handler: () => void) => void;
  exit: (code: number) => void;
  info: (message: string) => void;
  error: (message: string) => void;
}

const defaultDevDeps: DevDeps = {
  watch: (watchDir) =>
    chokidar.watch(watchDir, {
      ignoreInitial: true,
    }),
  startApp,
  stopChild,
  setTimeoutFn: setTimeout,
  clearTimeoutFn: clearTimeout,
  now: () => Date.now(),
  onSignal: (signal, handler) => {
    process.once(signal, handler);
  },
  exit: (code) => {
    process.exit(code);
  },
  info: (message) => {
    log.info(message, context);
  },
  error: (message) => {
    log.error(message, context);
  },
};

export async function runDev(
  config: ResolvedConfig,
  deps: DevDeps = defaultDevDeps,
) {
  const entry = path.resolve(config.entry);
  const crashLoopWindowMs = config.crashLoopWindowMs;
  const maxConsecutiveCrashRestarts = config.maxConsecutiveCrashRestarts;

  deps.info("Starting in dev mode");
  const watcher = deps.watch(config.watchDir);

  let restarting = false;
  let pendingRestart = false;
  let stopping = false;
  let crashCount = 0;
  let crashWindowStartedAt = 0;
  let restartTimeout: ReturnType<typeof setTimeout> | null = null;

  const handleChildExit = (code: number | null) => {
    if (stopping || restarting) {
      return;
    }

    if (code !== 0) {
      if (code !== null && NON_RESTARTABLE_EXIT_CODES.has(code)) {
        deps.error(
          `Application stopped with non-restartable exit code ${code}. Waiting for source changes...`,
        );
        return;
      }

      if (isCrashLoop()) {
        deps.error(
          `Application crashed ${maxConsecutiveCrashRestarts} times in ${Math.floor(
            crashLoopWindowMs / 1000,
          )}s. Waiting for source changes...`,
        );
        return;
      }

      scheduleRestart(`App crashed (code ${code})`);
    }
  };

  const createTrackedChild = () => {
    const next = deps.startApp(entry);
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
      deps.clearTimeoutFn(restartTimeout);
    }

    restartTimeout = deps.setTimeoutFn(() => {
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

        deps.info(`${reason} — restarting application`);
        await deps.stopChild(child);
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
      deps.clearTimeoutFn(restartTimeout);
      restartTimeout = null;
    }

    await watcher.close();
    await deps.stopChild(child);
    deps.exit(signal === "SIGINT" ? 130 : 143);
  };

  deps.onSignal("SIGINT", () => {
    void cleanup("SIGINT");
  });

  deps.onSignal("SIGTERM", () => {
    void cleanup("SIGTERM");
  });

  function isCrashLoop(): boolean {
    const now = deps.now();

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

export async function dev(config: ResolvedConfig) {
  await runDev(config);
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
      `Unable to resolve tsx CLI entry. Ensure "tsx" is installed. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function resetTsxCliEntryCacheForTests(): void {
  tsxCliEntryCache = null;
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

export const __devTestUtils = {
  resolveTsxCliPath,
  stopChild,
  resetTsxCliEntryCacheForTests,
};
