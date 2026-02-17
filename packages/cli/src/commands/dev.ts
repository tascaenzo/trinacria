import { spawn, ChildProcess } from "node:child_process";
import chokidar from "chokidar";
import path from "node:path";
import { ConsoleLogger } from "@trinacria/core";
import { ResolvedConfig } from "../config/config.contract";

const context = "TrinacriaCLI";
const log = new ConsoleLogger(context);
const RESTART_DEBOUNCE_MS = 100;
const STOP_TIMEOUT_MS = 3000;

export async function dev(config: ResolvedConfig) {
  const entry = path.resolve(config.entry);

  log.info("Starting in dev mode", context);

  const watcher = chokidar.watch(config.watchDir, {
    ignoreInitial: true,
  });

  let restarting = false;
  let pendingRestart = false;
  let stopping = false;
  let restartTimeout: NodeJS.Timeout | null = null;

  const handleChildExit = (code: number | null) => {
    if (stopping || restarting) {
      return;
    }

    if (code !== 0) {
      scheduleRestart(`App crashed (code ${code})`);
    }
  };

  const createTrackedChild = () => {
    const next = startApp(entry);
    next.on("exit", handleChildExit);
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
}

function startApp(entry: string): ChildProcess {
  return spawn(process.platform === "win32" ? "tsx.cmd" : "tsx", [entry], {
    stdio: "inherit",
  });
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
