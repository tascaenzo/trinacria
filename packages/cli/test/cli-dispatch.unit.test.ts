import assert from "node:assert/strict";
import test from "node:test";
import { main, printHelp, runCli } from "../src/cli";
import type { ResolvedConfig } from "../src/config/config.contract";

function createConfig(): ResolvedConfig {
  return {
    entry: "src/main.ts",
    outDir: "dist",
    watchDir: "src",
    env: "development",
    crashLoopWindowMs: 15000,
    maxConsecutiveCrashRestarts: 3,
  };
}

function createDeps() {
  const calls = {
    loadConfig: 0,
    dev: 0,
    build: 0,
    start: 0,
    createNewApp: 0,
    printHelp: 0,
    exitCodes: [] as number[],
    logErrors: [] as string[],
  };

  return {
    calls,
    deps: {
      loadConfig: async (_args: string[]) => {
        calls.loadConfig += 1;
        return createConfig();
      },
      dev: async () => {
        calls.dev += 1;
      },
      build: async () => {
        calls.build += 1;
      },
      start: async () => {
        calls.start += 1;
      },
      createNewApp: async () => {
        calls.createNewApp += 1;
      },
      printHelp: () => {
        calls.printHelp += 1;
      },
      exit: (code: number) => {
        calls.exitCodes.push(code);
      },
      logError: (message: string) => {
        calls.logErrors.push(message);
      },
    },
  };
}

test("runCli prints help and exits 0 with no command", async () => {
  const { deps, calls } = createDeps();
  await runCli([], deps);
  assert.equal(calls.printHelp, 1);
  assert.deepEqual(calls.exitCodes, [0]);
  assert.equal(calls.loadConfig, 0);
});

test("runCli dispatches dev command", async () => {
  const { deps, calls } = createDeps();
  await runCli(["dev"], deps);
  assert.equal(calls.loadConfig, 1);
  assert.equal(calls.dev, 1);
  assert.equal(calls.build, 0);
  assert.equal(calls.start, 0);
  assert.equal(calls.createNewApp, 0);
});

test("runCli dispatches build command", async () => {
  const { deps, calls } = createDeps();
  await runCli(["build"], deps);
  assert.equal(calls.loadConfig, 1);
  assert.equal(calls.build, 1);
});

test("runCli dispatches start command", async () => {
  const { deps, calls } = createDeps();
  await runCli(["start"], deps);
  assert.equal(calls.loadConfig, 1);
  assert.equal(calls.start, 1);
});

test("runCli dispatches new command without loading config", async () => {
  const { deps, calls } = createDeps();
  await runCli(["new", "my-app"], deps);
  assert.equal(calls.loadConfig, 0);
  assert.equal(calls.createNewApp, 1);
});

test("runCli dispatches create alias without loading config", async () => {
  const { deps, calls } = createDeps();
  await runCli(["create", "my-app"], deps);
  assert.equal(calls.loadConfig, 0);
  assert.equal(calls.createNewApp, 1);
});

test("runCli dispatches init alias without loading config", async () => {
  const { deps, calls } = createDeps();
  await runCli(["init", "my-app"], deps);
  assert.equal(calls.loadConfig, 0);
  assert.equal(calls.createNewApp, 1);
});

test("runCli handles unknown command with help and exit 1", async () => {
  const { deps, calls } = createDeps();
  await runCli(["unknown"], deps);
  assert.equal(calls.printHelp, 1);
  assert.deepEqual(calls.exitCodes, [1]);
  assert.equal(calls.logErrors[0]?.includes("Unknown command"), true);
});

test("runCli handles command failure and exits 1", async () => {
  const { deps, calls } = createDeps();
  deps.loadConfig = async () => {
    throw new Error("boom");
  };

  await runCli(["dev"], deps);
  assert.deepEqual(calls.exitCodes, [1]);
  assert.equal(calls.logErrors[0], "CLI execution failed");
});

test("printHelp writes usage text", () => {
  const originalLog = console.log;
  let output = "";
  console.log = (message?: unknown) => {
    output += String(message ?? "");
  };

  try {
    printHelp();
  } finally {
    console.log = originalLog;
  }

  assert.equal(output.includes("Usage:"), true);
  assert.equal(output.includes("trinacria dev"), true);
});

test("main handles --help via default deps and exits 0", async () => {
  const originalArgv = process.argv;
  const originalExit = process.exit;
  const originalLog = console.log;
  let exitCode: number | null = null;

  process.argv = ["node", "trinacria", "--help"];
  (process as any).exit = (code: number) => {
    exitCode = code;
    throw new Error(`EXIT_${code}`);
  };
  console.log = () => {};

  try {
    await assert.rejects(() => main(), /EXIT_0/);
    assert.equal(exitCode, 0);
  } finally {
    process.argv = originalArgv;
    (process as any).exit = originalExit;
    console.log = originalLog;
  }
});

test("main handles unknown command via default deps and exits 1", async () => {
  const originalArgv = process.argv;
  const originalExit = process.exit;
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  let exitCode: number | null = null;

  process.argv = ["node", "trinacria", "unknown-command"];
  (process as any).exit = (code: number) => {
    exitCode = code;
    throw new Error(`EXIT_${code}`);
  };
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};

  try {
    await assert.rejects(() => main(), /EXIT_1/);
    assert.equal(exitCode, 1);
  } finally {
    process.argv = originalArgv;
    (process as any).exit = originalExit;
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }
});
