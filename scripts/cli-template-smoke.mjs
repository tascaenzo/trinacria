#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const CLI_ENTRY = path.join(ROOT_DIR, "packages/cli/dist/index.js");
const NPM_CACHE = path.join(ROOT_DIR, ".npm-cache");

const TEMPLATE_MATRIX = [
  { name: "app-starter", hasHttp: false },
  { name: "cron-example", hasHttp: false },
  { name: "api-prisma-postgresql", hasHttp: true },
  { name: "api-mongoose-mongodb", hasHttp: true },
  { name: "api-events-redis", hasHttp: true },
  { name: "api-events-rabbitmq", hasHttp: true },
];

function parseArgs(argv) {
  const options = {
    keepTemp: false,
    skipBuildPackages: false,
    templates: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--keep-temp") {
      options.keepTemp = true;
      continue;
    }
    if (arg === "--skip-build-packages") {
      options.skipBuildPackages = true;
      continue;
    }
    if (arg === "--templates") {
      const raw = argv[i + 1];
      if (!raw) {
        throw new Error("Missing value for --templates");
      }
      i += 1;
      options.templates = raw.split(",").map((item) => item.trim()).filter(Boolean);
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function log(message) {
  console.log(`[cli-smoke] ${message}`);
}

function run(command, args, cwd, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      env: {
        ...process.env,
        NPM_CONFIG_CACHE: process.env.NPM_CONFIG_CACHE || NPM_CACHE,
        ...extraEnv,
      },
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed: ${command} ${args.join(" ")} (exit ${code})`));
    });
  });
}

async function runLongLived(command, args, cwd, options = {}) {
  const {
    bootMs = 3500,
    healthUrl = "",
    touchFile = "",
    stopSignal = "SIGINT",
    extraEnv = {},
  } = options;

  const child = spawn(command, args, {
    cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      NPM_CONFIG_CACHE: process.env.NPM_CONFIG_CACHE || NPM_CACHE,
      ...extraEnv,
    },
  });

  let exited = false;
  let exitCode = null;
  child.on("exit", (code) => {
    exited = true;
    exitCode = code;
  });

  await sleep(bootMs);
  if (exited) {
    throw new Error(`Process exited too early: ${command} ${args.join(" ")} (exit ${exitCode})`);
  }

  if (healthUrl) {
    await waitForHealth(healthUrl, 20_000);
  }

  if (touchFile) {
    writeFileSync(touchFile, `${readFileSync(touchFile, "utf8")}\n`, "utf8");
    await sleep(2500);
    if (exited) {
      throw new Error(`Dev process crashed after file change: ${command} ${args.join(" ")}`);
    }
  }

  child.kill(stopSignal);
  const finishedCode = await new Promise((resolve) => {
    child.on("exit", (code) => resolve(code));
  });

  if (![0, 130, 143, null].includes(finishedCode)) {
    throw new Error(`Unexpected exit code after stop: ${finishedCode}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(700);
  }

  throw new Error(`Health check failed for ${url}: ${String(lastError)}`);
}

function mapWorkspacePackagePaths() {
  return new Map([
    ["@trinacria/core", path.join(ROOT_DIR, "packages/core")],
    ["@trinacria/schema", path.join(ROOT_DIR, "packages/schema")],
    ["@trinacria/http", path.join(ROOT_DIR, "packages/http")],
    ["@trinacria/cron", path.join(ROOT_DIR, "packages/cron")],
    ["@trinacria/events", path.join(ROOT_DIR, "packages/events")],
    ["@trinacria/cli", path.join(ROOT_DIR, "packages/cli")],
  ]);
}

function rewriteTrinacriaDeps(appDir) {
  const packageJsonPath = path.join(appDir, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const packagePaths = mapWorkspacePackagePaths();

  for (const field of ["dependencies", "devDependencies"]) {
    const deps = packageJson[field] || {};
    for (const [name] of Object.entries(deps)) {
      if (!name.startsWith("@trinacria/")) {
        continue;
      }
      const localPath = packagePaths.get(name);
      if (!localPath) {
        throw new Error(`Missing local workspace mapping for ${name}`);
      }
      deps[name] = `file:${localPath}`;
    }
    packageJson[field] = deps;
  }

  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
}

function getTemplatePort(appDir) {
  const envExamplePath = path.join(appDir, ".env.example");
  try {
    const content = readFileSync(envExamplePath, "utf8");
    const line = content
      .split("\n")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith("PORT="));
    if (!line) return null;
    return Number(line.slice("PORT=".length).replaceAll('"', ""));
  } catch {
    return null;
  }
}

function prepareEnvFiles(appDir) {
  const envExample = path.join(appDir, ".env.example");
  if (!path.isAbsolute(envExample)) {
    return;
  }
  try {
    copyFileSync(envExample, path.join(appDir, ".env.development"));
  } catch {
    return;
  }
}

async function smokeTemplate(workspaceRoot, template) {
  const appName = `smoke-${template.name}`;
  const appDir = path.join(workspaceRoot, appName);

  log(`Generating ${template.name}...`);
  await run("node", [CLI_ENTRY, "new", appName, "--template", template.name, "--no-install", "--no-git"], workspaceRoot);

  rewriteTrinacriaDeps(appDir);
  prepareEnvFiles(appDir);

  log(`Installing dependencies for ${template.name}...`);
  await run("npm", ["install", "--no-audit", "--no-fund"], appDir);

  if (template.name === "api-prisma-postgresql") {
    log("Running prisma generate...");
    await run("npm", ["run", "prisma:generate"], appDir);
  }

  log(`Building ${template.name}...`);
  await run("npm", ["run", "build"], appDir);

  const port = getTemplatePort(appDir);
  const healthUrl = template.hasHttp && port ? `http://127.0.0.1:${port}/health` : "";

  log(`Starting ${template.name} (start)...`);
  await runLongLived("npm", ["run", "start"], appDir, {
    healthUrl,
    bootMs: 4000,
  });

  log(`Starting ${template.name} (dev/watch)...`);
  await runLongLived("npm", ["run", "dev"], appDir, {
    healthUrl,
    touchFile: path.join(appDir, "src", "main.ts"),
    bootMs: 4500,
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const templates = options.templates.length === 0
    ? TEMPLATE_MATRIX
    : TEMPLATE_MATRIX.filter((entry) => options.templates.includes(entry.name));

  if (templates.length === 0) {
    throw new Error("No templates selected for smoke test.");
  }

  const workspaceRoot = mkdtempSync(path.join(tmpdir(), "trinacria-cli-smoke-"));

  try {
    if (!options.skipBuildPackages) {
      log("Building framework packages required by templates...");
      await run("npm", ["run", "build:packages"], ROOT_DIR);
    }

    for (const template of templates) {
      await smokeTemplate(workspaceRoot, template);
    }

    log("CLI template smoke test completed successfully.");
  } finally {
    if (options.keepTemp) {
      log(`Temporary workspace kept at: ${workspaceRoot}`);
    } else {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
