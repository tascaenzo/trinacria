import { dev } from "./commands/dev";
import { build } from "./commands/build";
import { start } from "./commands/start";
import { createNewApp } from "./commands/new";
import { loadConfig } from "./config/load-config";
import { ConsoleLogger } from "@trinacria/core";

const context = "TrinacriaCLI";
const log = new ConsoleLogger(context);

export function printHelp() {
  console.log(`
Trinacria CLI

Usage:
  trinacria dev
  trinacria build
  trinacria start
  trinacria new <project-name> [--template <name>] [--no-install] [--no-git] [--force]

Options:
  --config <path>   Specify custom config file
  --help            Show help
`);
}

interface CliDeps {
  loadConfig: typeof loadConfig;
  dev: typeof dev;
  build: typeof build;
  start: typeof start;
  createNewApp: typeof createNewApp;
  printHelp: () => void;
  exit: (code: number) => void;
  logError: (message: string, error?: unknown) => void;
}

const defaultDeps: CliDeps = {
  loadConfig,
  dev,
  build,
  start,
  createNewApp,
  printHelp,
  exit: (code) => process.exit(code),
  logError: (message, error) =>
    log.error(message, error as Error | undefined, context),
};

export async function runCli(args: string[], deps: CliDeps = defaultDeps) {
  const command = args[0];

  if (!command || command === "--help") {
    deps.printHelp();
    deps.exit(0);
    return;
  }

  try {
    switch (command) {
      case "new":
        await deps.createNewApp(args.slice(1));
        break;

      case "dev":
      case "build":
      case "start": {
        const config = await deps.loadConfig(args);

        if (command === "dev") {
          await deps.dev(config);
        } else if (command === "build") {
          await deps.build(config);
        } else {
          await deps.start(config);
        }
        break;
      }

      default:
        deps.logError(`Unknown command: ${command}`);
        deps.printHelp();
        deps.exit(1);
        return;
    }
  } catch (err) {
    deps.logError("CLI execution failed", err);
    deps.exit(1);
    return;
  }
}

export async function main() {
  await runCli(process.argv.slice(2));
}
