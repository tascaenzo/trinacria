import fs from "node:fs";
import path from "node:path";

export interface LoadEnvironmentFilesOptions {
  roots: readonly string[];
  environment?: string;
  target?: NodeJS.ProcessEnv;
}

/**
 * Loads `.env` and `.env.<environment>` files without overriding variables
 * supplied by the operating system or deployment platform.
 */
export function loadEnvironmentFiles(
  options: LoadEnvironmentFilesOptions,
): string[] {
  const target = options.target ?? process.env;
  const environment = options.environment ?? target.ENV ?? "development";
  const roots = [...new Set(options.roots.map((root) => path.resolve(root)))];
  const merged: Record<string, string> = Object.create(null) as Record<
    string,
    string
  >;
  const loadedFiles: string[] = [];

  for (const fileName of [".env", `.env.${environment}`]) {
    for (const root of roots) {
      const filePath = path.join(root, fileName);
      if (!fs.existsSync(filePath)) continue;
      Object.assign(
        merged,
        parseEnvironmentFile(fs.readFileSync(filePath, "utf8")),
      );
      loadedFiles.push(filePath);
    }
  }

  for (const [key, value] of Object.entries(merged)) {
    if (target[key] === undefined) {
      target[key] = value;
    }
  }

  return loadedFiles;
}

export function parseEnvironmentFile(source: string): Record<string, string> {
  const parsed: Record<string, string> = Object.create(null) as Record<
    string,
    string
  >;

  for (const sourceLine of source.split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith("#")) continue;

    const normalized = line.startsWith("export ")
      ? line.slice("export ".length).trim()
      : line;
    const separator = normalized.indexOf("=");
    if (separator <= 0) continue;

    const key = normalized.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    const rawValue = normalized.slice(separator + 1).trim();
    parsed[key] = unquote(rawValue);
  }

  return parsed;
}

function unquote(value: string): string {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }
  return value;
}
