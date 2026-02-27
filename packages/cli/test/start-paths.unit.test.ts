import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { __startTestUtils } from "../src/commands/start";

function withTempDir(
  run: (dir: string) => Promise<void> | void,
): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "trinacria-cli-start-"));
  return Promise.resolve()
    .then(() => run(dir))
    .finally(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });
}

test("replaceSourceExtension maps TypeScript extensions to runtime targets", () => {
  const { replaceSourceExtension } = __startTestUtils;
  assert.equal(replaceSourceExtension("main.ts"), "main.js");
  assert.equal(replaceSourceExtension("main.tsx"), "main.js");
  assert.equal(replaceSourceExtension("main.mts"), "main.mjs");
  assert.equal(replaceSourceExtension("main.cts"), "main.cjs");
  assert.equal(replaceSourceExtension("main.js"), "main.js");
});

test("resolveCommonRootDir returns cwd for empty input", () => {
  const { resolveCommonRootDir } = __startTestUtils;
  assert.equal(resolveCommonRootDir([]), process.cwd());
});

test("resolveBuiltEntryPath maps entry from rootDir to outDir", async () => {
  await withTempDir(async (dir) => {
    const previousCwd = process.cwd();
    process.chdir(dir);
    try {
      fs.mkdirSync(path.join(dir, "src"), { recursive: true });
      fs.writeFileSync(path.join(dir, "src", "main.ts"), "export {};\n");
      fs.writeFileSync(
        path.join(dir, "tsconfig.json"),
        JSON.stringify(
          {
            compilerOptions: { rootDir: "src" },
            include: ["src/**/*.ts"],
          },
          null,
          2,
        ),
      );

      const built = __startTestUtils.resolveBuiltEntryPath(
        "src/main.ts",
        "dist",
      );
      const expected = path.resolve(dir, "dist", "main.js");
      const normalizeTmpPrefix = (value: string) =>
        value.startsWith("/private/") ? value.slice("/private".length) : value;
      assert.equal(normalizeTmpPrefix(built), normalizeTmpPrefix(expected));
    } finally {
      process.chdir(previousCwd);
    }
  });
});

test("resolveBuiltEntryPath throws when entry is outside resolved rootDir", async () => {
  await withTempDir(async (dir) => {
    const previousCwd = process.cwd();
    process.chdir(dir);
    try {
      fs.mkdirSync(path.join(dir, "src"), { recursive: true });
      fs.mkdirSync(path.join(dir, "other"), { recursive: true });
      fs.writeFileSync(path.join(dir, "src", "main.ts"), "export {};\n");
      fs.writeFileSync(path.join(dir, "other", "entry.ts"), "export {};\n");
      fs.writeFileSync(
        path.join(dir, "tsconfig.json"),
        JSON.stringify(
          {
            compilerOptions: { rootDir: "src" },
            include: ["src/**/*.ts", "other/**/*.ts"],
          },
          null,
          2,
        ),
      );

      assert.throws(
        () => __startTestUtils.resolveBuiltEntryPath("other/entry.ts", "dist"),
        /outside resolved TypeScript rootDir/,
      );
    } finally {
      process.chdir(previousCwd);
    }
  });
});

test("resolveBuiltEntryPath throws on malformed tsconfig", async () => {
  await withTempDir(async (dir) => {
    const previousCwd = process.cwd();
    process.chdir(dir);
    try {
      fs.mkdirSync(path.join(dir, "src"), { recursive: true });
      fs.writeFileSync(path.join(dir, "src", "main.ts"), "export {};\n");
      fs.writeFileSync(path.join(dir, "tsconfig.json"), "{ invalid");

      assert.throws(
        () => __startTestUtils.resolveBuiltEntryPath("src/main.ts", "dist"),
        /Failed to read tsconfig\.json/,
      );
    } finally {
      process.chdir(previousCwd);
    }
  });
});
