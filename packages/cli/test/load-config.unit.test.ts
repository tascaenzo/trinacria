import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../src/config/load-config";

function withTempDir(run: (dir: string) => Promise<void> | void): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "trinacria-cli-config-"));
  return Promise.resolve()
    .then(() => run(dir))
    .finally(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });
}

test("loadConfig returns defaults when no config file exists", async () => {
  await withTempDir(async (dir) => {
    const previousCwd = process.cwd();
    process.chdir(dir);
    try {
      const config = await loadConfig(["dev"]);
      assert.equal(config.entry, "src/main.ts");
      assert.equal(config.outDir, "dist");
      assert.equal(config.watchDir, "src");
      assert.equal(config.crashLoopWindowMs, 15000);
      assert.equal(config.maxConsecutiveCrashRestarts, 3);
    } finally {
      process.chdir(previousCwd);
    }
  });
});

test("loadConfig throws for missing --config value", async () => {
  await assert.rejects(() => loadConfig(["dev", "--config"]), /Missing value/);
});

test("loadConfig throws when explicit config file does not exist", async () => {
  await assert.rejects(
    () => loadConfig(["dev", "--config", "/does/not/exist/config.cjs"]),
    /Config file not found/,
  );
});

test("loadConfig loads explicit CommonJS config and normalizes numeric fields", async () => {
  await withTempDir(async (dir) => {
    const configPath = path.join(dir, "custom.config.cjs");
    fs.writeFileSync(
      configPath,
      `module.exports = {
  entry: "app/entry.ts",
  outDir: "build",
  watchDir: "app",
  env: "production",
  crashLoopWindowMs: "4200.8",
  maxConsecutiveCrashRestarts: "5.9"
};`,
      "utf8",
    );

    const config = await loadConfig(["dev", "--config", configPath]);
    assert.equal(config.entry, "app/entry.ts");
    assert.equal(config.outDir, "build");
    assert.equal(config.watchDir, "app");
    assert.equal(config.env, "production");
    assert.equal(config.crashLoopWindowMs, 4200);
    assert.equal(config.maxConsecutiveCrashRestarts, 5);
  });
});

test("loadConfig discovers default config in cwd and falls back for invalid crash policy", async () => {
  await withTempDir(async (dir) => {
    const previousCwd = process.cwd();
    process.chdir(dir);
    try {
      fs.writeFileSync(
        path.join(dir, "trinacria.config.cjs"),
        `module.exports = {
  entry: "src/server.ts",
  crashLoopWindowMs: 0,
  maxConsecutiveCrashRestarts: 0
};`,
        "utf8",
      );

      const config = await loadConfig(["start"]);
      assert.equal(config.entry, "src/server.ts");
      assert.equal(config.crashLoopWindowMs, 15000);
      assert.equal(config.maxConsecutiveCrashRestarts, 3);
    } finally {
      process.chdir(previousCwd);
    }
  });
});

test("loadConfig default lookup prefers .js over .cjs/.mjs", async () => {
  await withTempDir(async (dir) => {
    const previousCwd = process.cwd();
    process.chdir(dir);
    try {
      fs.writeFileSync(
        path.join(dir, "trinacria.config.cjs"),
        `module.exports = { entry: "from-cjs.ts" };`,
        "utf8",
      );
      fs.writeFileSync(
        path.join(dir, "trinacria.config.js"),
        `module.exports = { entry: "from-js.ts" };`,
        "utf8",
      );

      const config = await loadConfig(["dev"]);
      assert.equal(config.entry, "from-js.ts");
    } finally {
      process.chdir(previousCwd);
    }
  });
});

test("loadConfig default lookup falls back to .mjs when js/cjs are absent", async () => {
  await withTempDir(async (dir) => {
    const previousCwd = process.cwd();
    process.chdir(dir);
    try {
      fs.writeFileSync(
        path.join(dir, "trinacria.config.mjs"),
        `export default { entry: "from-mjs.ts" };`,
        "utf8",
      );

      const config = await loadConfig(["dev"]);
      assert.equal(config.entry, "from-mjs.ts");
    } finally {
      process.chdir(previousCwd);
    }
  });
});

test("loadConfig supports ESM config fallback when require hits ERR_REQUIRE_ESM", async () => {
  await withTempDir(async (dir) => {
    const configPath = path.join(dir, "trinacria.config.mjs");
    fs.writeFileSync(
      configPath,
      `export default {
  entry: "src/esm-main.ts",
  outDir: "dist-esm"
};`,
      "utf8",
    );

    const config = await loadConfig(["dev", "--config", configPath]);
    assert.equal(config.entry, "src/esm-main.ts");
    assert.equal(config.outDir, "dist-esm");
  });
});
