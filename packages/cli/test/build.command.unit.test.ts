import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { build } from "../src/commands/build";
import type { ResolvedConfig } from "../src/config/config.contract";

class ExitError extends Error {
  constructor(public readonly code: number) {
    super(`EXIT_${code}`);
  }
}

function withTempDir(
  run: (dir: string) => Promise<void> | void,
): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "trinacria-cli-build-"));
  return Promise.resolve()
    .then(() => run(dir))
    .finally(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });
}

function withExitIntercept<T>(run: () => Promise<T> | T): Promise<T> {
  const originalExit = process.exit;
  (process as any).exit = (code?: number) => {
    throw new ExitError(code ?? 0);
  };

  return Promise.resolve()
    .then(() => run())
    .finally(() => {
      (process as any).exit = originalExit;
    });
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

function createConfig(outDir = "dist"): ResolvedConfig {
  return {
    entry: "src/main.ts",
    outDir,
    watchDir: "src",
    env: "production",
    crashLoopWindowMs: 15000,
    maxConsecutiveCrashRestarts: 3,
  };
}

test("build exits with code 1 when tsconfig.json is missing", async () => {
  await withTempDir(async (dir) => {
    const previousCwd = process.cwd();
    process.chdir(dir);
    try {
      await assert.rejects(
        () =>
          withSilencedOutput(() =>
            withExitIntercept(() => build(createConfig())),
          ),
        (error: unknown) => error instanceof ExitError && error.code === 1,
      );
    } finally {
      process.chdir(previousCwd);
    }
  });
});

test("build exits with code 1 when tsconfig.json is malformed", async () => {
  await withTempDir(async (dir) => {
    const previousCwd = process.cwd();
    process.chdir(dir);
    try {
      fs.writeFileSync(path.join(dir, "tsconfig.json"), "{ invalid");

      await assert.rejects(
        () =>
          withSilencedOutput(() =>
            withExitIntercept(() => build(createConfig())),
          ),
        (error: unknown) => error instanceof ExitError && error.code === 1,
      );
    } finally {
      process.chdir(previousCwd);
    }
  });
});

test("build succeeds and emits output on valid project", async () => {
  await withTempDir(async (dir) => {
    const previousCwd = process.cwd();
    process.chdir(dir);
    try {
      fs.mkdirSync(path.join(dir, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(dir, "src", "main.ts"),
        "export const ok = 1;\n",
      );
      fs.writeFileSync(
        path.join(dir, "tsconfig.json"),
        JSON.stringify(
          {
            compilerOptions: {
              target: "ES2022",
              module: "CommonJS",
              rootDir: "src",
            },
            include: ["src/**/*.ts"],
          },
          null,
          2,
        ),
        "utf8",
      );

      await withSilencedOutput(() => build(createConfig("build-out")));
      assert.equal(fs.existsSync(path.join(dir, "build-out", "main.js")), true);
    } finally {
      process.chdir(previousCwd);
    }
  });
});

test("build exits with code 1 when TypeScript diagnostics contain errors", async () => {
  await withTempDir(async (dir) => {
    const previousCwd = process.cwd();
    process.chdir(dir);
    try {
      fs.mkdirSync(path.join(dir, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(dir, "src", "main.ts"),
        "const value: string = 123;\nexport { value };\n",
        "utf8",
      );
      fs.writeFileSync(
        path.join(dir, "tsconfig.json"),
        JSON.stringify(
          {
            compilerOptions: {
              target: "ES2022",
              module: "CommonJS",
              rootDir: "src",
            },
            include: ["src/**/*.ts"],
          },
          null,
          2,
        ),
        "utf8",
      );

      await assert.rejects(
        () =>
          withSilencedOutput(() =>
            withExitIntercept(() => build(createConfig("dist"))),
          ),
        (error: unknown) => error instanceof ExitError && error.code === 1,
      );
    } finally {
      process.chdir(previousCwd);
    }
  });
});
