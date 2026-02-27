import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { start } from "../src/commands/start";
import type { ResolvedConfig } from "../src/config/config.contract";

function withTempDir(
  run: (dir: string) => Promise<void> | void,
): Promise<void> {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), "trinacria-cli-start-cmd-"),
  );
  return Promise.resolve()
    .then(() => run(dir))
    .finally(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });
}

function createConfig(): ResolvedConfig {
  return {
    entry: "src/main.ts",
    outDir: "dist",
    watchDir: "src",
    env: "production",
    crashLoopWindowMs: 15000,
    maxConsecutiveCrashRestarts: 3,
  };
}

function withSilencedOutput<T>(run: () => Promise<T> | T): Promise<T> {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  (process.stdout as any).write = () => true;
  (process.stderr as any).write = () => true;

  return Promise.resolve()
    .then(() => run())
    .finally(() => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
      (process.stdout as any).write = originalStdoutWrite;
      (process.stderr as any).write = originalStderrWrite;
    });
}

test("start throws when built entry does not exist", async () => {
  await withTempDir(async (dir) => {
    const previousCwd = process.cwd();
    process.chdir(dir);
    try {
      await assert.rejects(
        () => withSilencedOutput(() => start(createConfig())),
        /Built entry file not found/,
      );
    } finally {
      process.chdir(previousCwd);
    }
  });
});

test("start resolves when child exits with code 0", async () => {
  await withTempDir(async (dir) => {
    const previousCwd = process.cwd();
    process.chdir(dir);
    try {
      fs.mkdirSync(path.join(dir, "dist", "src"), { recursive: true });
      fs.writeFileSync(
        path.join(dir, "dist", "src", "main.js"),
        "process.exit(0);\n",
        "utf8",
      );

      await withSilencedOutput(() => start(createConfig()));
    } finally {
      process.chdir(previousCwd);
    }
  });
});

test("start rejects when child exits with non-zero code", async () => {
  await withTempDir(async (dir) => {
    const previousCwd = process.cwd();
    process.chdir(dir);
    try {
      fs.mkdirSync(path.join(dir, "dist", "src"), { recursive: true });
      fs.writeFileSync(
        path.join(dir, "dist", "src", "main.js"),
        "process.exit(2);\n",
        "utf8",
      );

      await assert.rejects(
        () => withSilencedOutput(() => start(createConfig())),
        /Exited with code 2/,
      );
    } finally {
      process.chdir(previousCwd);
    }
  });
});
