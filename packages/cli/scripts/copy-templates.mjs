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
  copiedCount += 1;
}

if (copiedCount === 0) {
  throw new Error(
    `[copy-templates] no templates found in ${appsRoot}. Make sure at least one app template is available.`,
  );
}
