import { execSync } from "node:child_process";

function run(command, options = {}) {
  execSync(command, {
    stdio: "inherit",
    ...options,
  });
}

function read(command) {
  return execSync(command, { encoding: "utf8" }).trim();
}

const WORKSPACES = [
  { prefix: "packages/core/", name: "@trinacria/core", test: true },
  { prefix: "packages/schema/", name: "@trinacria/schema", test: true },
  { prefix: "packages/http/", name: "@trinacria/http", test: true },
  { prefix: "packages/cli/", name: "@trinacria/cli", test: true },
  { prefix: "apps/playground/", name: "playground", test: false },
];

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
  ? WORKSPACES.map((w) => w.name)
  : WORKSPACES.filter((w) => touched.has(w.name)).map((w) => w.name);

const testTargets = runAll
  ? WORKSPACES.filter((w) => w.test).map((w) => w.name)
  : WORKSPACES.filter((w) => w.test && touched.has(w.name)).map((w) => w.name);

if (lintTargets.length === 0 && testTargets.length === 0) {
  process.exit(0);
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
