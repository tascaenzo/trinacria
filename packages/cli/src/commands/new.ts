import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { ConsoleLogger } from "@trinacria/core";

const context = "TrinacriaCLI";
const log = new ConsoleLogger(context);
const DEFAULT_GITIGNORE = "node_modules\ndist\n.env\n";

const TEMPLATE_APP_NAMES = [
  "app-starter",
  "cron-example",
  "api-prisma-postgresql",
  "api-mongoose-mongodb",
  "api-events-redis",
  "api-events-rabbitmq",
] as const;

type TemplateAppName = (typeof TEMPLATE_APP_NAMES)[number];

interface NewOptions {
  projectName: string;
  template: TemplateAppName;
  install: boolean;
  git: boolean;
  force: boolean;
}

interface NewDeps {
  cwd: () => string;
  templatesRoot: () => string;
  pathExists: (target: string) => boolean;
  mkdir: (target: string) => void;
  readdir: (target: string) => fs.Dirent[];
  stat: (target: string) => fs.Stats;
  readFile: (target: string) => string;
  writeFile: (target: string, content: string) => void;
  copyFile: (from: string, to: string) => void;
  runCommand: (command: string, args: string[], cwd: string) => Promise<void>;
  info: (message: string) => void;
}

const defaultDeps: NewDeps = {
  cwd: () => process.cwd(),
  templatesRoot: () => resolveTemplatesRoot(),
  pathExists: (target) => fs.existsSync(target),
  mkdir: (target) => fs.mkdirSync(target, { recursive: true }),
  readdir: (target) => fs.readdirSync(target, { withFileTypes: true }),
  stat: (target) => fs.statSync(target),
  readFile: (target) => fs.readFileSync(target, "utf8"),
  writeFile: (target, content) => fs.writeFileSync(target, content, "utf8"),
  copyFile: (from, to) => fs.copyFileSync(from, to),
  runCommand: (command, args, cwd) =>
    new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        stdio: "inherit",
      });
      child.on("error", reject);
      child.on("exit", (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`Command failed: ${command} ${args.join(" ")}`));
      });
    }),
  info: (message) => log.info(message, context),
};

function resolveTemplatesRoot(): string {
  const distributedTemplatesRoot = path.resolve(__dirname, "../templates");
  if (fs.existsSync(distributedTemplatesRoot)) {
    return distributedTemplatesRoot;
  }

  return path.resolve(__dirname, "../../../../apps");
}

export async function createNewApp(
  args: string[],
  deps: NewDeps = defaultDeps,
) {
  const options = parseNewArgs(args);
  const sourceDir = resolveTemplatePath(options.template, deps.templatesRoot());
  const targetDir = path.resolve(deps.cwd(), options.projectName);
  const cliVersion = resolveCurrentCliVersion();

  ensureTargetDirectory(targetDir, options.force, deps);
  copyDirectory(sourceDir, targetDir, deps);
  ensureGeneratedProjectFiles(targetDir, deps);
  adaptGeneratedPackageJson(targetDir, options.projectName, cliVersion, deps);

  deps.info(
    `Project "${options.projectName}" generated from template "${options.template}".`,
  );

  if (options.git) {
    deps.info("Initializing git repository...");
    await deps.runCommand("git", ["init"], targetDir);
  }

  if (options.install) {
    const packageManager = detectPackageManager();
    const command = packageManager === "npm" ? "npm" : packageManager;
    const commandArgs = packageManager === "npm" ? ["install"] : ["install"];
    deps.info(`Installing dependencies with ${packageManager}...`);
    await deps.runCommand(command, commandArgs, targetDir);
  }
}

function parseNewArgs(args: string[]): NewOptions {
  const positionals: string[] = [];
  let templateInput = "app-starter";
  let install = true;
  let git = true;
  let force = false;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (!arg.startsWith("-")) {
      positionals.push(arg);
      continue;
    }

    if (arg === "--template" || arg === "-t") {
      const next = args[index + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("Missing value for --template <name>.");
      }

      templateInput = next;
      index += 1;
      continue;
    }

    if (arg === "--install") {
      install = true;
      continue;
    }

    if (arg === "--no-install") {
      install = false;
      continue;
    }

    if (arg === "--git") {
      git = true;
      continue;
    }

    if (arg === "--no-git") {
      git = false;
      continue;
    }

    if (arg === "--force" || arg === "-f") {
      force = true;
      continue;
    }

    throw new Error(`Unknown option for "new": ${arg}`);
  }

  const projectName = positionals[0];
  if (!projectName) {
    throw new Error(
      `Missing project name. Usage: trinacria new <project-name> [--template <name>] [--no-install] [--no-git] [--force]. Available templates: ${TEMPLATE_APP_NAMES.join(
        ", ",
      )}.`,
    );
  }

  const template = normalizeTemplateName(templateInput);

  return {
    projectName,
    template,
    install,
    git,
    force,
  };
}

function normalizeTemplateName(templateInput: string): TemplateAppName {
  const normalized = templateInput.trim().toLowerCase();

  if (
    normalized === "minimal" ||
    normalized === "starter" ||
    normalized === "base" ||
    normalized === "default"
  ) {
    return "app-starter";
  }

  if (isTemplateAppName(normalized)) {
    return normalized;
  }

  throw new Error(
    `Unknown template "${templateInput}". Available templates: ${TEMPLATE_APP_NAMES.join(
      ", ",
    )}, minimal.`,
  );
}

function isTemplateAppName(value: string): value is TemplateAppName {
  return (TEMPLATE_APP_NAMES as readonly string[]).includes(value);
}

function resolveTemplatePath(
  template: TemplateAppName,
  templatesRoot: string,
): string {
  const templatePath = path.resolve(templatesRoot, template);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template source not found: ${templatePath}`);
  }

  return templatePath;
}

function ensureTargetDirectory(
  targetDir: string,
  force: boolean,
  deps: NewDeps,
): void {
  if (!deps.pathExists(targetDir)) {
    deps.mkdir(targetDir);
    return;
  }

  const stat = deps.stat(targetDir);
  if (!stat.isDirectory()) {
    throw new Error(`Target path exists and is not a directory: ${targetDir}`);
  }

  const entries = deps.readdir(targetDir);
  if (entries.length > 0 && !force) {
    throw new Error(
      `Target directory is not empty: ${targetDir}. Use --force to continue.`,
    );
  }
}

function copyDirectory(fromDir: string, toDir: string, deps: NewDeps): void {
  for (const entry of deps.readdir(fromDir)) {
    if (shouldSkipEntry(entry.name)) {
      continue;
    }

    const sourcePath = path.resolve(fromDir, entry.name);
    const targetPath = path.resolve(toDir, entry.name);

    if (entry.isDirectory()) {
      deps.mkdir(targetPath);
      copyDirectory(sourcePath, targetPath, deps);
      continue;
    }

    deps.copyFile(sourcePath, targetPath);
  }
}

function shouldSkipEntry(entryName: string): boolean {
  return (
    entryName === "dist" || entryName === "node_modules" || entryName === ".git"
  );
}

function resolveCurrentCliVersion(): string {
  const packageJsonPath = path.resolve(__dirname, "../../package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
    version?: unknown;
  };

  if (typeof packageJson.version === "string" && packageJson.version.length > 0) {
    return packageJson.version;
  }

  return "latest";
}

function ensureGeneratedProjectFiles(targetDir: string, deps: NewDeps): void {
  const envExamplePath = path.resolve(targetDir, ".env.example");
  const envPath = path.resolve(targetDir, ".env");
  if (deps.pathExists(envExamplePath) && !deps.pathExists(envPath)) {
    deps.writeFile(envPath, deps.readFile(envExamplePath));
  }

  const gitignorePath = path.resolve(targetDir, ".gitignore");
  if (!deps.pathExists(gitignorePath)) {
    deps.writeFile(gitignorePath, DEFAULT_GITIGNORE);
  }
}

function adaptGeneratedPackageJson(
  targetDir: string,
  projectName: string,
  cliVersion: string,
  deps: NewDeps,
): void {
  const packageJsonPath = path.resolve(targetDir, "package.json");
  if (!deps.pathExists(packageJsonPath)) {
    return;
  }

  const packageJson = JSON.parse(deps.readFile(packageJsonPath)) as Record<
    string,
    unknown
  >;
  const projectBaseName = path.basename(targetDir);
  packageJson.name = projectBaseName || projectName;

  const scripts = normalizeScripts(
    packageJson.scripts as Record<string, unknown> | undefined,
  );
  packageJson.scripts = scripts;

  const dependencies = normalizeDependencyMap(
    packageJson.dependencies as Record<string, unknown> | undefined,
    cliVersion,
  );
  const devDependencies = normalizeDependencyMap(
    packageJson.devDependencies as Record<string, unknown> | undefined,
    cliVersion,
  );

  const cliDependencyVersion =
    dependencies["@trinacria/cli"] ?? devDependencies["@trinacria/cli"];
  if (cliDependencyVersion) {
    delete dependencies["@trinacria/cli"];
    devDependencies["@trinacria/cli"] = cliDependencyVersion;
  } else {
    devDependencies["@trinacria/cli"] = toCompatibleRange(cliVersion);
  }

  if (!devDependencies.typescript) {
    devDependencies.typescript = "latest";
  }
  if (!devDependencies["@types/node"]) {
    devDependencies["@types/node"] = "latest";
  }

  packageJson.dependencies = dependencies;
  packageJson.devDependencies = devDependencies;

  deps.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function normalizeScripts(
  scriptsInput: Record<string, unknown> | undefined,
): Record<string, string> {
  const scripts: Record<string, string> = {};
  for (const [key, value] of Object.entries(scriptsInput ?? {})) {
    if (typeof value === "string") {
      scripts[key] = value;
    }
  }

  scripts.dev = "trinacria dev";
  scripts.build = "trinacria build";
  scripts.start = "trinacria start";

  return scripts;
}

function normalizeDependencyMap(
  input: Record<string, unknown> | undefined,
  cliVersion: string,
): Record<string, string> {
  const output: Record<string, string> = {};

  for (const [pkgName, version] of Object.entries(input ?? {})) {
    if (typeof version !== "string") {
      continue;
    }

    if (!pkgName.startsWith("@trinacria/")) {
      output[pkgName] = version;
      continue;
    }

    let resolvedVersion = version;
    if (version === "*") {
      if (pkgName === "@trinacria/cli") {
        resolvedVersion = cliVersion;
      } else {
        resolvedVersion = resolveWorkspacePackageVersion(pkgName) || "latest";
      }
    }

    output[pkgName] = toCompatibleRange(resolvedVersion);
  }

  return output;
}

function toCompatibleRange(version: string): string {
  if (version === "latest") {
    return version;
  }

  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(-.+)?$/);
  if (!match) {
    return version;
  }

  if (match[4]) {
    return `^${version}`;
  }

  return `^${match[1]}.${match[2]}.${match[3]}`;
}

function resolveWorkspacePackageVersion(pkgName: string): string | null {
  const shortName = pkgName.replace("@trinacria/", "");
  const packageJsonPath = path.resolve(
    __dirname,
    "../../../../packages",
    shortName,
    "package.json",
  );

  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
    version?: unknown;
  };
  if (typeof packageJson.version !== "string" || packageJson.version.length === 0) {
    return null;
  }

  return packageJson.version;
}

function detectPackageManager(): "npm" | "pnpm" | "yarn" | "bun" {
  const userAgent = process.env.npm_config_user_agent ?? "";
  if (userAgent.startsWith("pnpm/")) return "pnpm";
  if (userAgent.startsWith("yarn/")) return "yarn";
  if (userAgent.startsWith("bun/")) return "bun";
  return "npm";
}

export const __newTestUtils = {
  parseNewArgs,
  normalizeTemplateName,
  normalizeDependencyMap,
  normalizeScripts,
  adaptGeneratedPackageJson,
  ensureGeneratedProjectFiles,
  ensureTargetDirectory,
};
