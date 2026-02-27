import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { __newTestUtils, createNewApp } from "../src/commands/new";

function withTempDir(run: (dir: string) => Promise<void> | void): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "trinacria-cli-new-"));
  return Promise.resolve()
    .then(() => run(dir))
    .finally(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });
}

test("parseNewArgs applies expected defaults", () => {
  const parsed = __newTestUtils.parseNewArgs(["my-app"]);
  assert.equal(parsed.projectName, "my-app");
  assert.equal(parsed.template, "app-starter");
  assert.equal(parsed.install, true);
  assert.equal(parsed.git, true);
  assert.equal(parsed.force, false);
});

test("parseNewArgs supports alias template and flags", () => {
  const parsed = __newTestUtils.parseNewArgs([
    "my-app",
    "--template",
    "minimal",
    "--no-install",
    "--no-git",
    "--force",
  ]);
  assert.equal(parsed.template, "app-starter");
  assert.equal(parsed.install, false);
  assert.equal(parsed.git, false);
  assert.equal(parsed.force, true);
});

test("parseNewArgs supports starter aliases", () => {
  const starter = __newTestUtils.parseNewArgs([
    "my-app",
    "--template",
    "starter",
  ]);
  const base = __newTestUtils.parseNewArgs(["my-app", "--template", "base"]);
  const defaultTemplate = __newTestUtils.parseNewArgs([
    "my-app",
    "--template",
    "default",
  ]);

  assert.equal(starter.template, "app-starter");
  assert.equal(base.template, "app-starter");
  assert.equal(defaultTemplate.template, "app-starter");
});

test("createNewApp generates project from apps/app-starter", async () => {
  await withTempDir(async (dir) => {
    const previousCwd = process.cwd();
    process.chdir(dir);
    try {
      await createNewApp(["my-generated-app", "--no-install", "--no-git"]);

      const targetDir = path.join(dir, "my-generated-app");
      assert.equal(fs.existsSync(path.join(targetDir, "src", "main.ts")), true);
      assert.equal(fs.existsSync(path.join(targetDir, "trinacria.config.mjs")), true);
      assert.equal(fs.existsSync(path.join(targetDir, ".gitignore")), true);

      const tsconfig = JSON.parse(
        fs.readFileSync(path.join(targetDir, "tsconfig.json"), "utf8"),
      ) as {
        extends?: string;
        compilerOptions?: Record<string, unknown>;
      };
      assert.equal(Boolean(tsconfig.extends), false);
      assert.equal(tsconfig.compilerOptions?.target, "ES2022");

      const packageJson = JSON.parse(
        fs.readFileSync(path.join(targetDir, "package.json"), "utf8"),
      ) as {
        name: string;
        scripts: Record<string, string>;
        dependencies: Record<string, string>;
        devDependencies: Record<string, string>;
      };

      assert.equal(packageJson.name, "my-generated-app");
      assert.equal(packageJson.scripts.dev, "trinacria dev");
      assert.equal(packageJson.scripts.build, "trinacria build");
      assert.equal(packageJson.scripts.start, "trinacria start");
      assert.equal(packageJson.dependencies["@trinacria/core"], "latest");
      assert.equal(packageJson.dependencies["@trinacria/cli"], undefined);
      assert.equal(packageJson.devDependencies["@trinacria/cli"], "latest");
      assert.equal(packageJson.devDependencies.typescript, "latest");
      assert.equal(packageJson.devDependencies["@types/node"], "latest");
    } finally {
      process.chdir(previousCwd);
    }
  });
});

test("createNewApp fails for unknown template", async () => {
  await assert.rejects(
    () => createNewApp(["my-app", "--template", "playground", "--no-install", "--no-git"]),
    /Unknown template/,
  );
});

test("createNewApp fails if target directory is not empty without --force", async () => {
  await withTempDir(async (dir) => {
    const previousCwd = process.cwd();
    process.chdir(dir);
    try {
      fs.mkdirSync(path.join(dir, "my-app"), { recursive: true });
      fs.writeFileSync(path.join(dir, "my-app", "existing.txt"), "data", "utf8");

      await assert.rejects(
        () => createNewApp(["my-app", "--no-install", "--no-git"]),
        /Target directory is not empty/,
      );
    } finally {
      process.chdir(previousCwd);
    }
  });
});
