import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(cliRoot, "../..");
const appsRoot = path.resolve(repoRoot, "apps");
const packagesRoot = path.resolve(repoRoot, "packages");
const distTemplatesRoot = path.resolve(cliRoot, "dist/templates");

const templateNames = [
  "app-starter",
  "cron-example",
  "api-prisma-postgresql",
  "api-mongoose-mongodb",
  "api-events-redis",
  "api-events-rabbitmq",
];

fs.mkdirSync(distTemplatesRoot, { recursive: true });

function getWorkspaceVersions() {
  const versions = new Map();
  const packageDirs = fs.readdirSync(packagesRoot, { withFileTypes: true });
  for (const entry of packageDirs) {
    if (!entry.isDirectory()) continue;
    const packageJsonPath = path.resolve(packagesRoot, entry.name, "package.json");
    if (!fs.existsSync(packageJsonPath)) continue;
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    if (
      typeof packageJson.name === "string" &&
      packageJson.name.startsWith("@trinacria/") &&
      typeof packageJson.version === "string"
    ) {
      versions.set(packageJson.name, packageJson.version);
    }
  }
  return versions;
}

function pinTrinacriaDeps(packageJsonPath, versions) {
  if (!fs.existsSync(packageJsonPath)) return;
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  for (const field of ["dependencies", "devDependencies"]) {
    const deps = packageJson[field];
    if (!deps || typeof deps !== "object") continue;
    for (const depName of Object.keys(deps)) {
      if (!depName.startsWith("@trinacria/")) continue;
      const version = versions.get(depName);
      if (!version) continue;
      deps[depName] = version;
    }
  }
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

const workspaceVersions = getWorkspaceVersions();

let copiedCount = 0;

for (const templateName of templateNames) {
  const source = path.resolve(appsRoot, templateName);
  const target = path.resolve(distTemplatesRoot, templateName);

  if (!fs.existsSync(source)) {
    console.warn(`[copy-templates] skip missing template: ${source}`);
    continue;
  }

  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, {
    recursive: true,
    force: true,
    filter: (entryPath) => {
      const name = path.basename(entryPath);
      return name !== "node_modules" && name !== "dist" && name !== ".git";
    },
  });
  pinTrinacriaDeps(path.resolve(target, "package.json"), workspaceVersions);
  copiedCount += 1;
}

if (copiedCount === 0) {
  throw new Error(
    `[copy-templates] no templates found in ${appsRoot}. Make sure at least one app template is available.`,
  );
}
