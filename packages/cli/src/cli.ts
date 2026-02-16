import { dev } from "./commands/dev";
import { build } from "./commands/build";
import { start } from "./commands/start";
import { loadConfig } from "./config/load-config";
import { ConsoleLogger } from "@trinacria/core";

const context = "TrinacriaCLI";
const log = new ConsoleLogger(context);

function printHelp() {
  console.log(`
Trinacria CLI

Usage:
  trinacria dev
  trinacria build
  trinacria start

Options:
  --config <path>   Specify custom config file
  --help            Show help
`);
}

export async function main() {
  const args = process.argv.slice(2);

  const command = args[0];

  if (!command || command === "--help") {
    printHelp();
    process.exit(0);
  }

  try {
    // Carica config una sola volta
    const config = await loadConfig(args);

    switch (command) {
      case "dev":
        await dev(config);
        break;

      case "build":
        await build(config);
        break;

      case "start":
        await start(config);
        break;

      default:
        log.error(`Unknown command: ${command}`, undefined, context);
        printHelp();
        process.exit(1);
    }
  } catch (err) {
    log.error("CLI execution failed", err as Error, context);
    process.exit(1);
  }
}
