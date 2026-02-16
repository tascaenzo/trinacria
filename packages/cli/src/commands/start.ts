import { spawn } from "node:child_process";
import path from "node:path";
import { ConsoleLogger } from "@trinacria/core";
import { ResolvedConfig } from "../config/config.contract";

const context = "TrinacriaCLI";
const log = new ConsoleLogger(context);

export async function start(config: ResolvedConfig) {
  const entryFileName = path.basename(config.entry).replace(".ts", ".js");

  const entry = path.resolve(config.outDir, entryFileName);

  log.info(`Starting application in production mode (${entry})`, context);

  await new Promise<void>((resolve, reject) => {
    const child = spawn("node", [entry], {
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Exited with code ${code}`));
      } else {
        resolve();
      }
    });

    child.on("error", reject);
  });
}
