import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function run(command, options = {}) {
  execSync(command, {
    stdio: "inherit",
    ...options,
  });
}

function read(command) {
  return execSync(command, { encoding: "utf8" }).trim();
}

const rootPackage = JSON.parse(fs.readFileSync("package.json", "utf8"));
const workspacePatterns = Array.isArray(rootPackage.workspaces)
  ? rootPackage.workspaces
  : [];

const WORKSPACES = discoverWorkspaces(workspacePatterns);

const GLOBAL_FILES = new Set([
  "package.json",
  "package-lock.json",
  "tsconfig.base.json",
]);

const stagedOutput = read("git diff --cached --name-only --diff-filter=ACMR");
const stagedFiles = stagedOutput.length ? stagedOutput.split("\n") : [];

if (stagedFiles.length === 0) {
  process.exit(0);
}

const eslintTargets = stagedFiles.filter((file) =>
  /\.(ts|mts|cts|js|mjs|cjs)$/.test(file),
);

const runAll =
  stagedFiles.some((file) => GLOBAL_FILES.has(file)) ||
  stagedFiles.some((file) => file.startsWith("scripts/"));

const touched = new Set();
for (const file of stagedFiles) {
  for (const workspace of WORKSPACES) {
    if (file.startsWith(workspace.prefix)) {
      touched.add(workspace.name);
    }
  }
}

const lintTargets = runAll
  ? WORKSPACES.filter((w) => w.build).map((w) => w.name)
  : WORKSPACES.filter((w) => w.build && touched.has(w.name)).map((w) => w.name);

const testTargets = runAll
  ? WORKSPACES.filter((w) => w.test).map((w) => w.name)
  : WORKSPACES.filter((w) => w.test && touched.has(w.name)).map((w) => w.name);

if (
  lintTargets.length === 0 &&
  testTargets.length === 0 &&
  eslintTargets.length === 0
) {
  process.exit(0);
}

if (eslintTargets.length > 0) {
  console.log("[pre-commit] Running eslint static checks...");
  run(`npx eslint ${eslintTargets.map(shellQuote).join(" ")}`);
}

console.log("[pre-commit] Running workspace build checks...");
for (const workspace of lintTargets) {
  run(`npm run build -w ${workspace}`);
}

if (testTargets.length > 0) {
  console.log("[pre-commit] Running workspace tests...");
  for (const workspace of testTargets) {
    run(`npm run test -w ${workspace}`);
  }
}

console.log("[pre-commit] Checks passed.");

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function discoverWorkspaces(patterns) {
  const workspaces = [];

  for (const pattern of patterns) {
    if (!pattern.endsWith("/*")) {
      continue;
    }

    const baseDir = pattern.slice(0, -2);
    if (baseDir !== "packages") {
      continue;
    }
    if (!fs.existsSync(baseDir)) {
      continue;
    }

    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const workspaceDir = path.join(baseDir, entry.name);
      const packageJsonPath = path.join(workspaceDir, "package.json");
      if (!fs.existsSync(packageJsonPath)) {
        continue;
      }

      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      const scripts = pkg.scripts ?? {};

      workspaces.push({
        name: pkg.name,
        prefix: `${workspaceDir.replace(/\\/g, "/")}/`,
        build: typeof scripts.build === "string",
        test: typeof scripts.test === "string",
      });
    }
  }

  return workspaces;
}
