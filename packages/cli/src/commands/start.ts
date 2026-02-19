import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { ConsoleLogger } from "@trinacria/core";
import { ResolvedConfig } from "../config/config.contract";

const context = "TrinacriaCLI";
const log = new ConsoleLogger(context);

export async function start(config: ResolvedConfig) {
  const entry = resolveBuiltEntryPath(config.entry, config.outDir);

  log.info(`Starting application in production mode (${entry})`, context);

  if (!fs.existsSync(entry)) {
    throw new Error(
      `Built entry file not found: ${entry}. Run "trinacria build" first or verify tsconfig rootDir/outDir.`,
    );
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [entry], {
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

function resolveBuiltEntryPath(entry: string, outDir: string): string {
  const entryAbs = path.resolve(entry);
  const outDirAbs = path.resolve(outDir);
  const configPath = ts.findConfigFile(
    process.cwd(),
    ts.sys.fileExists,
    "tsconfig.json",
  );

  let rootDirAbs = process.cwd();
  if (configPath) {
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    if (configFile.error) {
      throw new Error(
        `Failed to read tsconfig.json: ${ts.flattenDiagnosticMessageText(
          configFile.error.messageText,
          "\n",
        )}`,
      );
    }

    const parsed = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(configPath),
      { outDir: outDirAbs },
    );

    if (parsed.errors.length > 0) {
      const message = parsed.errors
        .map((diagnostic) =>
          ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
        )
        .join("; ");
      throw new Error(`Failed to parse tsconfig.json: ${message}`);
    }

    if (parsed.options.rootDir) {
      rootDirAbs = path.resolve(parsed.options.rootDir);
    } else {
      rootDirAbs = resolveCommonRootDir(parsed.fileNames);
    }
  }

  const relativeFromRoot = path.relative(rootDirAbs, entryAbs);
  if (
    relativeFromRoot.startsWith("..") ||
    path.isAbsolute(relativeFromRoot) ||
    relativeFromRoot === ""
  ) {
    throw new Error(
      `Entry "${entryAbs}" is outside resolved TypeScript rootDir "${rootDirAbs}".`,
    );
  }

  return path.resolve(outDirAbs, replaceSourceExtension(relativeFromRoot));
}

function resolveCommonRootDir(fileNames: readonly string[]): string {
  if (fileNames.length === 0) {
    return process.cwd();
  }

  const directories = fileNames.map((file) => path.dirname(path.resolve(file)));
  let common = directories[0];

  for (let i = 1; i < directories.length; i++) {
    common = commonDirectory(common, directories[i]);
  }

  return common;
}

function commonDirectory(a: string, b: string): string {
  const aParts = path.resolve(a).split(path.sep);
  const bParts = path.resolve(b).split(path.sep);
  const length = Math.min(aParts.length, bParts.length);
  const shared: string[] = [];

  for (let i = 0; i < length; i++) {
    if (aParts[i] !== bParts[i]) break;
    shared.push(aParts[i]);
  }

  if (shared.length === 0) {
    return process.cwd();
  }

  return shared.join(path.sep) || path.sep;
}

function replaceSourceExtension(filePath: string): string {
  if (filePath.endsWith(".mts")) return filePath.slice(0, -4) + ".mjs";
  if (filePath.endsWith(".cts")) return filePath.slice(0, -4) + ".cjs";
  if (filePath.endsWith(".tsx")) return filePath.slice(0, -4) + ".js";
  if (filePath.endsWith(".ts")) return filePath.slice(0, -3) + ".js";
  return filePath;
}
