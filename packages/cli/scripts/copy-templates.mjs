import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(cliRoot, "../..");
const appsRoot = path.resolve(repoRoot, "apps");
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

for (const templateName of templateNames) {
  const source = path.resolve(appsRoot, templateName);
  const target = path.resolve(distTemplatesRoot, templateName);

  if (!fs.existsSync(source)) {
    throw new Error(`Template source not found: ${source}`);
  }

  fs.cpSync(source, target, {
    recursive: true,
    force: true,
    filter: (entryPath) => {
      const name = path.basename(entryPath);
      return name !== "node_modules" && name !== "dist" && name !== ".git";
    },
  });
}

