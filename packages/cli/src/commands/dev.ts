import { spawn, ChildProcess } from "node:child_process";
import chokidar from "chokidar";
import path from "node:path";
import { ConsoleLogger } from "@trinacria/core";
import { ResolvedConfig } from "../config/config.contract";

const context = "TrinacriaCLI";
const log = new ConsoleLogger(context);

export async function dev(config: ResolvedConfig) {
  const entry = path.resolve(config.entry);

  log.info("Starting in dev mode", context);

  let child = startApp(entry);

  const watcher = chokidar.watch("src", {
    ignoreInitial: true,
  });

  let restartTimeout: NodeJS.Timeout | null = null;

  watcher.on("all", () => {
    if (restartTimeout) {
      clearTimeout(restartTimeout);
    }

    restartTimeout = setTimeout(() => {
      log.info("Source changed — restarting application", context);

      child.kill();
      child = startApp(entry);
    }, 100); // debounce
  });

  child.on("exit", (code) => {
    if (code !== 0) {
      log.error(`App crashed (code ${code}) — restarting`, undefined, context);
      child = startApp(entry);
    }
  });
}

function startApp(entry: string): ChildProcess {
  return spawn(process.platform === "win32" ? "tsx.cmd" : "tsx", [entry], {
    stdio: "inherit",
  });
}
