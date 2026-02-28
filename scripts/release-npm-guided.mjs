#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const PACKAGES_DIR = path.join(ROOT_DIR, "packages");
const APPS_DIR = path.join(ROOT_DIR, "apps");
const LOCAL_NPM_CACHE_DIR = path.join(ROOT_DIR, ".tmp/npm-cache");
const NPM_REGISTRY = "https://registry.npmjs.org";
const HELP_TEXT = `
Usage:
  node scripts/release-npm-guided.mjs

Interactive flow:
  1) choose package from numeric menu
  2) choose release tag (alpha/beta/rc/latest)
  3) choose bump strategy for latest
  4) choose suggested version or custom
  5) choose publish mode (publish/dry-run)

Then the script runs pre-checks and publishes (or dry-run).
`;

function run(cmd, args, { cwd = ROOT_DIR, capture = false } = {}) {
  const printable = `${cmd} ${args.join(" ")}`.trim();
  console.log(`\n$ ${printable}`);
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      NPM_CONFIG_CACHE: process.env.NPM_CONFIG_CACHE || LOCAL_NPM_CACHE_DIR,
    },
    stdio: capture ? ["inherit", "pipe", "pipe"] : "inherit",
  });

  if (result.status !== 0) {
    if (capture) {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    }
    throw new Error(`Command failed: ${printable}`);
  }

  return {
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
  };
}

function listWorkspacePackageJsonFiles() {
  const roots = [PACKAGES_DIR, APPS_DIR];
  const files = [];

  for (const root of roots) {
    if (!existsSync(root)) {
      continue;
    }

    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      files.push(path.join(root, entry.name, "package.json"));
    }
  }

  files.push(path.join(ROOT_DIR, "package-lock.json"));
  return files;
}

function snapshotFiles(paths) {
  const snapshot = new Map();
  for (const filePath of paths) {
    snapshot.set(
      filePath,
      existsSync(filePath) ? readFileSync(filePath, "utf8") : null,
    );
  }
  return snapshot;
}

function restoreSnapshot(snapshot) {
  for (const [filePath, content] of snapshot.entries()) {
    if (content === null) {
      if (existsSync(filePath)) {
        rmSync(filePath, { force: true });
      }
      continue;
    }

    writeFileSync(filePath, content, "utf8");
  }
}

function getPublicPackages() {
  if (!existsSync(PACKAGES_DIR)) {
    throw new Error(`Directory not found: ${PACKAGES_DIR}`);
  }

  return readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((dirName) => {
      const packageJsonPath = path.join(PACKAGES_DIR, dirName, "package.json");
      if (!existsSync(packageJsonPath)) {
        return null;
      }

      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
      if (pkg.private || !pkg.name || !pkg.version) {
        return null;
      }

      return {
        name: String(pkg.name),
        version: String(pkg.version),
      };
    })
    .filter(Boolean);
}

function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) {
    throw new Error(`Unsupported version format: ${version}`);
  }

  const preRaw = match[4] || "";
  let preTag = "";
  let preNum = null;
  if (preRaw) {
    const dotMatch = preRaw.match(/^([0-9A-Za-z-]+)\.(\d+)$/);
    if (dotMatch) {
      preTag = dotMatch[1];
      preNum = Number(dotMatch[2]);
    } else {
      const hyphenMatch = preRaw.match(/^([0-9A-Za-z-]+)-\d+$/);
      preTag = hyphenMatch ? hyphenMatch[1] : preRaw;
    }
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    preRaw,
    preTag,
    preNum,
  };
}

function stringifyVersion(v) {
  const base = `${v.major}.${v.minor}.${v.patch}`;
  if (!v.preTag) return base;
  return `${base}-${v.preTag}.${v.preNum ?? 0}`;
}

function bumpStable(version, bump) {
  const v = parseVersion(version);
  if (v.preRaw && bump === "patch") {
    return `${v.major}.${v.minor}.${v.patch}`;
  }
  if (bump === "major") {
    return `${v.major + 1}.0.0`;
  }
  if (bump === "minor") {
    return `${v.major}.${v.minor + 1}.0`;
  }
  return `${v.major}.${v.minor}.${v.patch + 1}`;
}

function suggestPrerelease(version, tag) {
  const v = parseVersion(version);
  if (v.preTag === tag && Number.isInteger(v.preNum)) {
    return stringifyVersion({ ...v, preNum: v.preNum + 1 });
  }
  if (v.preTag === tag) {
    return `${v.major}.${v.minor}.${v.patch}-${tag}.0`;
  }
  if (v.preTag) {
    return `${v.major}.${v.minor}.${v.patch}-${tag}.0`;
  }
  return `${v.major}.${v.minor}.${v.patch + 1}-${tag}.0`;
}

async function ask(rl, question, fallback = "") {
  const suffix = fallback ? ` [${fallback}]` : "";
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || fallback;
}

async function askChoice(rl, title, choices, defaultIndex = 0) {
  if (!choices.length) {
    throw new Error("No choices available.");
  }
  if (defaultIndex < 0 || defaultIndex >= choices.length) {
    throw new Error(`Invalid default index: ${defaultIndex}`);
  }

  console.log(`\n${title}`);
  for (let i = 0; i < choices.length; i += 1) {
    const marker = i === defaultIndex ? " (default)" : "";
    console.log(`  ${i + 1}) ${choices[i]}${marker}`);
  }

  while (true) {
    const raw = await ask(rl, "Selection number", String(defaultIndex + 1));
    const index = Number(raw) - 1;
    if (Number.isInteger(index) && index >= 0 && index < choices.length) {
      return index;
    }
    console.log(
      `Invalid choice: ${raw}. Enter a number from 1 to ${choices.length}.`,
    );
  }
}

async function main() {
  if (process.argv.includes("--help")) {
    console.log(HELP_TEXT.trim());
    return;
  }

  if (!process.stdin.isTTY) {
    throw new Error("Interactive mode requires a TTY terminal.");
  }

  const packages = getPublicPackages();
  if (packages.length === 0) {
    throw new Error("No public packages found in packages/*");
  }

  const defaultPackage =
    packages.find((pkg) => pkg.name === "@trinacria/cli")?.name ||
    packages[0].name;

  const packageChoices = packages.map(
    (pkg) => `${pkg.name} (current: ${pkg.version})`,
  );

  const rl = readline.createInterface({ input, output });

  try {
    const defaultPackageIndex = Math.max(
      0,
      packages.findIndex((pkg) => pkg.name === defaultPackage),
    );
    const packageIndex = await askChoice(
      rl,
      "Select package to publish:",
      packageChoices,
      defaultPackageIndex,
    );
    const selected = packages[packageIndex];
    const packageName = selected.name;

    const tagChoices = ["alpha", "beta", "rc", "latest"];
    const tagIndex = await askChoice(rl, "Select release tag:", tagChoices, 0);
    const tag = tagChoices[tagIndex];

    let bump = "patch";
    if (tag === "latest") {
      const bumpChoices = ["patch", "minor", "major"];
      const bumpIndex = await askChoice(
        rl,
        "Select bump strategy for stable release:",
        bumpChoices,
        0,
      );
      bump = bumpChoices[bumpIndex];
    }

    const suggestedVersion =
      tag === "latest"
        ? bumpStable(selected.version, bump)
        : suggestPrerelease(selected.version, tag);
    const versionChoices = [
      `Use suggested version: ${suggestedVersion}`,
      "Enter custom version",
    ];
    const versionChoiceIndex = await askChoice(
      rl,
      "Select version to publish:",
      versionChoices,
      0,
    );
    const version =
      versionChoiceIndex === 0
        ? suggestedVersion
        : await ask(rl, "Enter custom version", suggestedVersion);

    const publishChoices = [
      "Publish now to npm",
      "Dry-run only (do not publish)",
    ];
    const publishChoiceIndex = await askChoice(
      rl,
      "Confirm final action:",
      publishChoices,
      1,
    );
    const shouldPublish = publishChoiceIndex === 0;

    console.log("\nRelease configuration:");
    console.log(`- package: ${packageName}`);
    console.log(`- current: ${selected.version}`);
    console.log(`- next: ${version}`);
    console.log(`- tag: ${tag}`);
    console.log(`- publish: ${shouldPublish ? "yes" : "no (dry-run)"}`);
    console.log("- cli smoke gate: disabled");

    console.log("\nPre-check...");
    run("npm", ["whoami", "--registry", NPM_REGISTRY]);
    run("npm", ["run", "build", "-w", packageName]);
    run("npm", ["run", "test", "-w", packageName, "--if-present"]);
    run("npm", [
      "pack",
      "--dry-run",
      "-w",
      packageName,
      "--cache",
      LOCAL_NPM_CACHE_DIR,
    ]);

    const manifestFiles = listWorkspacePackageJsonFiles();
    const manifestSnapshot = snapshotFiles(manifestFiles);

    console.log("\nUpdating local package version...");
    run("npm", [
      "version",
      version,
      "-w",
      packageName,
      "--no-git-tag-version",
      "--no-workspaces-update",
    ]);

    const publishArgs = [
      "scripts/publish-libs.mjs",
      "--mode",
      "npm",
      "--packages",
      packageName,
      "--registry",
      NPM_REGISTRY,
      "--access",
      "public",
      "--tag",
      tag,
      "--skip-existing",
      "--skip-build",
      "--skip-test",
    ];
    if (!shouldPublish) {
      publishArgs.push("--dry-run");
    }
    publishArgs.push("--skip-cli-smoke");

    try {
      run("node", publishArgs);

      if (!shouldPublish) {
        console.log(
          "\nDry-run completed. Run the wizard again and choose publish to release.",
        );
      } else {
        console.log("\nPublish completed.");
      }
    } finally {
      restoreSnapshot(manifestSnapshot);
      console.log(
        "\nWorkspace manifests restored (package.json/package-lock.json).",
      );
    }
  } finally {
    rl.close();
  }
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nError: ${message}`);
  process.exit(1);
}
