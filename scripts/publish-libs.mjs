#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const PACKAGES_DIR = path.join(ROOT_DIR, "packages");
const LOCAL_NPM_CACHE_DIR = path.join(ROOT_DIR, ".npm-cache");

const HELP_TEXT = `
Usage:
  node scripts/publish-libs.mjs [options]

Options:
  --mode <pack|npm|git>          Execution mode (default: pack)
  --packages <pkg1,pkg2>         Comma-separated package names (default: all public packages in packages/*)
  --registry <url>               NPM registry URL (used only in npm mode)
  --access <public|restricted>   Access mode for npm publish (default: public)
  --artifacts-dir <path>         Output folder for artifacts (default: .artifacts/npm)
  --tag-prefix <prefix>          Prefix for git tags in git mode (default: empty)
  --git-remote <name>            Git remote for tag push in git mode (default: origin)
  --push                         Push tags to remote in git mode
  --skip-build                   Skip build step
  --skip-test                    Skip test step
  --allow-dirty                  Allow git mode even with dirty working tree
  --dry-run                      Do everything except publish/tag/push
  --help                         Show this message

Examples:
  node scripts/publish-libs.mjs --mode pack
  node scripts/publish-libs.mjs --mode npm --registry https://registry.npmjs.org
  node scripts/publish-libs.mjs --mode npm --dry-run
  node scripts/publish-libs.mjs --mode git --push --tag-prefix release/
`;

function parseArgs(argv) {
  const options = {
    mode: "pack",
    packages: [],
    registry: "",
    access: "public",
    artifactsDir: ".artifacts/npm",
    tagPrefix: "",
    gitRemote: "origin",
    push: false,
    skipBuild: false,
    skipTest: false,
    allowDirty: false,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help") {
      options.help = true;
      continue;
    }
    if (arg === "--push") {
      options.push = true;
      continue;
    }
    if (arg === "--skip-build") {
      options.skipBuild = true;
      continue;
    }
    if (arg === "--skip-test") {
      options.skipTest = true;
      continue;
    }
    if (arg === "--allow-dirty") {
      options.allowDirty = true;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    const [flag, valueFromEquals] = arg.split("=");
    const takeValue = (fallback = "") => {
      if (valueFromEquals !== undefined) {
        return valueFromEquals;
      }
      if (i + 1 >= argv.length) {
        throw new Error(`Missing value for ${flag}`);
      }
      i += 1;
      return argv[i] ?? fallback;
    };

    if (flag === "--mode") {
      options.mode = takeValue();
      continue;
    }
    if (flag === "--packages") {
      const raw = takeValue();
      options.packages = raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      continue;
    }
    if (flag === "--registry") {
      options.registry = takeValue();
      continue;
    }
    if (flag === "--access") {
      options.access = takeValue();
      continue;
    }
    if (flag === "--artifacts-dir") {
      options.artifactsDir = takeValue();
      continue;
    }
    if (flag === "--tag-prefix") {
      options.tagPrefix = takeValue();
      continue;
    }
    if (flag === "--git-remote") {
      options.gitRemote = takeValue();
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function run(command, args, opts = {}) {
  const printable = `${command} ${args.join(" ")}`.trim();
  console.log(`\n$ ${printable}`);
  const result = spawnSync(command, args, {
    cwd: opts.cwd ?? ROOT_DIR,
    encoding: "utf8",
    env: {
      ...process.env,
      NPM_CONFIG_CACHE: process.env.NPM_CONFIG_CACHE || LOCAL_NPM_CACHE_DIR,
    },
    stdio: opts.capture ? ["inherit", "pipe", "pipe"] : "inherit",
  });

  if (result.status !== 0) {
    if (opts.capture) {
      if (result.stdout) {
        process.stdout.write(result.stdout);
      }
      if (result.stderr) {
        process.stderr.write(result.stderr);
      }
    }
    throw new Error(`Command failed: ${printable}`);
  }

  if (opts.capture) {
    return {
      stdout: (result.stdout || "").trim(),
      stderr: (result.stderr || "").trim(),
    };
  }

  return { stdout: "", stderr: "" };
}

function getWorkspacePackages() {
  if (!existsSync(PACKAGES_DIR)) {
    throw new Error(`Directory not found: ${PACKAGES_DIR}`);
  }

  const dirs = readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const packages = [];
  for (const dirName of dirs) {
    const packageJsonPath = path.join(PACKAGES_DIR, dirName, "package.json");
    if (!existsSync(packageJsonPath)) {
      continue;
    }
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    if (pkg.private) {
      continue;
    }
    if (!pkg.name || !pkg.version) {
      continue;
    }
    packages.push({
      name: String(pkg.name),
      version: String(pkg.version),
      dir: path.join(PACKAGES_DIR, dirName),
    });
  }
  return packages;
}

function selectPackages(allPackages, requestedPackages) {
  if (requestedPackages.length === 0) {
    return allPackages;
  }

  const map = new Map(allPackages.map((pkg) => [pkg.name, pkg]));
  const selected = [];
  for (const name of requestedPackages) {
    const pkg = map.get(name);
    if (!pkg) {
      throw new Error(`Package not found or private: ${name}`);
    }
    selected.push(pkg);
  }
  return selected;
}

function ensureCleanGitTree() {
  const { stdout } = run("git", ["status", "--porcelain"], { capture: true });
  if (stdout) {
    throw new Error(
      "Git working tree is not clean. Commit/stash changes or use --allow-dirty.",
    );
  }
}

function tagExists(tag) {
  const result = spawnSync("git", ["tag", "--list", tag], {
    cwd: ROOT_DIR,
    encoding: "utf8",
  });
  return result.status === 0 && (result.stdout || "").trim() === tag;
}

function artifactPackageDirName(packageName) {
  return packageName.replace(/^@/, "").replace(/\//g, "--");
}

function extractPackJson(stdoutText) {
  const text = stdoutText.trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Unable to parse npm pack JSON output:\n${stdoutText}`);
  }
  const parsed = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("npm pack --json returned an empty result.");
  }
  return parsed[0];
}

function sha256File(filePath) {
  const hash = createHash("sha256");
  hash.update(readFileSync(filePath));
  return hash.digest("hex");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(HELP_TEXT.trim());
    return;
  }

  if (!["pack", "npm", "git"].includes(options.mode)) {
    throw new Error(`Invalid --mode "${options.mode}". Use pack, npm or git.`);
  }
  if (!["public", "restricted"].includes(options.access)) {
    throw new Error(`Invalid --access "${options.access}". Use public or restricted.`);
  }

  const workspacePackages = getWorkspacePackages();
  const selectedPackages = selectPackages(workspacePackages, options.packages);
  if (selectedPackages.length === 0) {
    throw new Error("No packages selected.");
  }

  const artifactsDirAbs = path.resolve(ROOT_DIR, options.artifactsDir);
  mkdirSync(artifactsDirAbs, { recursive: true });
  mkdirSync(LOCAL_NPM_CACHE_DIR, { recursive: true });

  console.log("Selected packages:");
  for (const pkg of selectedPackages) {
    console.log(`- ${pkg.name}@${pkg.version}`);
  }

  if (options.mode === "git" && !options.allowDirty) {
    ensureCleanGitTree();
  }

  if (!options.skipBuild) {
    console.log("\nBuilding selected packages...");
    for (const pkg of selectedPackages) {
      run("npm", ["run", "build", "-w", pkg.name]);
    }
  }

  if (!options.skipTest) {
    console.log("\nRunning tests for selected packages...");
    for (const pkg of selectedPackages) {
      run("npm", ["run", "test", "-w", pkg.name, "--if-present"]);
    }
  }

  console.log(`\nGenerating artifacts in ${artifactsDirAbs}...`);
  const artifactRecords = [];
  for (const pkg of selectedPackages) {
    const packageArtifactDir = path.join(
      artifactsDirAbs,
      artifactPackageDirName(pkg.name),
      pkg.version,
    );
    rmSync(packageArtifactDir, { recursive: true, force: true });
    mkdirSync(packageArtifactDir, { recursive: true });

    const { stdout } = run(
      "npm",
      ["pack", "-w", pkg.name, "--pack-destination", packageArtifactDir, "--json"],
      { capture: true },
    );
    const packEntry = extractPackJson(stdout);
    const tarballPath = path.join(packageArtifactDir, packEntry.filename);
    const sha256 = sha256File(tarballPath);
    const shaFilePath = `${tarballPath}.sha256`;
    writeFileSync(shaFilePath, `${sha256}  ${path.basename(tarballPath)}\n`, "utf8");

    artifactRecords.push({
      name: pkg.name,
      version: pkg.version,
      tarball: tarballPath,
      sha256,
      integrity: packEntry.integrity,
      shasum: packEntry.shasum,
      size: packEntry.size,
      unpackedSize: packEntry.unpackedSize,
    });

    console.log(`- ${pkg.name}@${pkg.version}`);
    console.log(`  tarball: ${tarballPath}`);
    console.log(`  sha256: ${shaFilePath}`);
  }

  const manifestPath = path.join(artifactsDirAbs, "manifest.json");
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mode: options.mode,
        packages: artifactRecords,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(`\nArtifact manifest: ${manifestPath}`);

  if (options.mode === "pack") {
    console.log("\nDone. Artifacts ready for manual publish.");
    return;
  }

  if (options.mode === "npm") {
    console.log("\nPublishing to npm registry...");
    for (const artifact of artifactRecords) {
      const args = ["publish", artifact.tarball, "--access", options.access];
      if (options.registry) {
        args.push("--registry", options.registry);
      }
      if (options.dryRun) {
        args.push("--dry-run");
      }
      run("npm", args);
    }
    if (options.dryRun) {
      console.log("\nDry run completed. No package was published.");
    } else {
      console.log("\nPublish completed.");
    }
    return;
  }

  console.log("\nCreating git tags...");
  for (const artifact of artifactRecords) {
    const tag = `${options.tagPrefix}${artifact.name}@${artifact.version}`;
    if (tagExists(tag)) {
      console.log(`- skip existing tag: ${tag}`);
      continue;
    }

    if (options.dryRun) {
      console.log(`- dry-run tag: ${tag}`);
      continue;
    }

    run("git", ["tag", "-a", tag, "-m", `release: ${artifact.name}@${artifact.version}`]);
    console.log(`- created: ${tag}`);

    if (options.push) {
      run("git", ["push", options.gitRemote, tag]);
      console.log(`- pushed: ${tag} -> ${options.gitRemote}`);
    }
  }

  if (options.dryRun) {
    console.log("\nDry run completed. No tag was created/pushed.");
  } else {
    console.log("\nGit release flow completed.");
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nError: ${message}`);
  process.exit(1);
}
