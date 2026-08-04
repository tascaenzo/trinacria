import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import test from "node:test";
import { __devTestUtils } from "../src/commands/dev";

test("resolveTsxCliPath returns a stable cached path", () => {
  __devTestUtils.resetTsxCliEntryCacheForTests();

  const first = __devTestUtils.resolveTsxCliPath();
  const second = __devTestUtils.resolveTsxCliPath();

  assert.equal(first, second);
  assert.equal(first.includes("tsx"), true);
});

test("stopChild resolves immediately when process is already stopped", async () => {
  const alreadyStopped = {
    exitCode: 0,
    signalCode: null,
  } as any;

  await __devTestUtils.stopChild(alreadyStopped);
});

test("stopChild terminates a running process with SIGTERM", async () => {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: "ignore",
  });

  await __devTestUtils.stopChild(child);

  assert.equal(child.exitCode !== null || child.signalCode !== null, true);
});

test("stopChild falls back to SIGKILL when process does not stop in time", async () => {
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  const killSignals: string[] = [];

  global.setTimeout = ((callback: (...args: any[]) => void) => {
    callback();
    return { unref() {} } as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  global.clearTimeout = (() => {}) as typeof clearTimeout;

  const fakeChild = new EventEmitter() as any;
  fakeChild.exitCode = null;
  fakeChild.signalCode = null;
  fakeChild.kill = (signal: string) => {
    killSignals.push(signal);
    if (signal === "SIGTERM") {
      setImmediate(() => {
        fakeChild.exitCode = 0;
        fakeChild.emit("exit", 0, null);
      });
    }
    return true;
  };

  try {
    await __devTestUtils.stopChild(fakeChild);
    assert.equal(killSignals.includes("SIGKILL"), true);
    assert.equal(killSignals.includes("SIGTERM"), true);
  } finally {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  }
});
