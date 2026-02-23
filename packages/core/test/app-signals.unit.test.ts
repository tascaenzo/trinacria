import test from "node:test";
import assert from "node:assert/strict";
import { TrinacriaApp } from "../src/application/trinacria-app.ts";

test("signal handler exits with 0 when shutdown succeeds", async () => {
  const app = new TrinacriaApp();
  const originalExit = process.exit;
  const exitCodes: number[] = [];

  (process as any).exit = ((code?: number) => {
    exitCodes.push(code ?? 0);
    return undefined as never;
  }) as typeof process.exit;

  try {
    await app.start();
    await (app as any).handleSignal("SIGINT");
  } finally {
    (process as any).exit = originalExit;
  }

  assert.deepEqual(exitCodes, [0]);
});

test("signal handler exits with 1 when shutdown fails", async () => {
  const app = new TrinacriaApp();
  const originalExit = process.exit;
  const originalShutdown = app.shutdown.bind(app);
  const exitCodes: number[] = [];

  (process as any).exit = ((code?: number) => {
    exitCodes.push(code ?? 0);
    return undefined as never;
  }) as typeof process.exit;

  (app as any).shutdown = async () => {
    throw new Error("forced shutdown error");
  };

  try {
    await app.start();
    await (app as any).handleSignal("SIGTERM");
  } finally {
    (process as any).exit = originalExit;
    (app as any).shutdown = originalShutdown;
  }

  assert.deepEqual(exitCodes, [1]);
});
