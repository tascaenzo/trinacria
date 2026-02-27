#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const PACKAGES_DIR = path.join(ROOT_DIR, "packages");

function parseArgs(argv) {
  const options = {
    fromScope: "@trinacria",
    toScope: "@tascaenzo",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const [flag, valueFromEquals] = arg.split("=");
    const takeValue = () => {
      if (valueFromEquals !== undefined) {
        return valueFromEquals;
      }
      if (i + 1 >= argv.length) {
        throw new Error(`Missing value for ${flag}`);
      }
      i += 1;
      return argv[i];
    };

    if (flag === "--from-scope") {
      options.fromScope = takeValue();
      continue;
    }
    if (flag === "--to-scope") {
      options.toScope = takeValue();
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function remapScope(value, fromPrefix, toPrefix) {
  if (typeof value !== "string") {
    return value;
  }
  if (!value.startsWith(fromPrefix)) {
    return value;
  }
  return `${toPrefix}${value.slice(fromPrefix.length)}`;
}

function remapDependencyMap(map, fromPrefix, toPrefix) {
  if (!map || typeof map !== "object") {
    return map;
  }

  const entries = Object.entries(map).map(([name, version]) => [
    remapScope(name, fromPrefix, toPrefix),
    version,
  ]);
  return Object.fromEntries(entries);
}

function run() {
  const options = parseArgs(process.argv.slice(2));
  const fromPrefix = `${options.fromScope}/`;
  const toPrefix = `${options.toScope}/`;

  if (!existsSync(PACKAGES_DIR)) {
    throw new Error(`Directory not found: ${PACKAGES_DIR}`);
  }

  const dirs = readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  let changed = 0;

  for (const dirName of dirs) {
    const packageJsonPath = path.join(PACKAGES_DIR, dirName, "package.json");
    if (!existsSync(packageJsonPath)) {
      continue;
    }

    const originalText = readFileSync(packageJsonPath, "utf8");
    const pkg = JSON.parse(originalText);

    pkg.name = remapScope(pkg.name, fromPrefix, toPrefix);
    pkg.dependencies = remapDependencyMap(pkg.dependencies, fromPrefix, toPrefix);
    pkg.devDependencies = remapDependencyMap(pkg.devDependencies, fromPrefix, toPrefix);
    pkg.peerDependencies = remapDependencyMap(pkg.peerDependencies, fromPrefix, toPrefix);
    pkg.optionalDependencies = remapDependencyMap(
      pkg.optionalDependencies,
      fromPrefix,
      toPrefix,
    );

    const nextText = `${JSON.stringify(pkg, null, 2)}\n`;
    if (nextText !== originalText) {
      writeFileSync(packageJsonPath, nextText, "utf8");
      changed += 1;
      console.log(`updated ${packageJsonPath}`);
    }
  }

  console.log(`done. package.json updated: ${changed}`);
}

try {
  run();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
}
