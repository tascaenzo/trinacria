import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { defaultConfig } from "./default-config";
import type { ResolvedConfig, TrinacriaConfig } from "./config.contract";

export async function loadConfig(args: string[]): Promise<ResolvedConfig> {
  const configFlagIndex = args.indexOf("--config");
  const hasExplicitConfig = configFlagIndex !== -1;

  let configPath: string | null;

  if (hasExplicitConfig && args[configFlagIndex + 1]) {
    configPath = path.resolve(args[configFlagIndex + 1]);
  } else if (hasExplicitConfig) {
    throw new Error("Missing value for --config <path>.");
  } else {
    configPath = resolveDefaultConfigPath();
  }

  if (hasExplicitConfig && configPath && !fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  if (!configPath || !fs.existsSync(configPath)) {
    return defaultConfig;
  }

  try {
    // 🟢 Prima prova CommonJS
    const required = require(configPath);
    const userConfig: TrinacriaConfig = required.default ?? required;

    return {
      ...defaultConfig,
      ...userConfig,
    };
  } catch (err: any) {
    // 🔵 Se è errore ESM → fallback a dynamic import
    if (err.code === "ERR_REQUIRE_ESM") {
      const module = await import(pathToFileURL(configPath).href);
      const userConfig: TrinacriaConfig = module.default ?? module;

      return {
        ...defaultConfig,
        ...userConfig,
      };
    }

    throw new Error(
      `Failed to load config file "${configPath}": ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

function resolveDefaultConfigPath(): string | null {
  const cwd = process.cwd();

  const possibleFiles = [
    "trinacria.config.js",
    "trinacria.config.cjs",
    "trinacria.config.mjs",
  ];

  for (const file of possibleFiles) {
    const fullPath = path.resolve(cwd, file);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}
