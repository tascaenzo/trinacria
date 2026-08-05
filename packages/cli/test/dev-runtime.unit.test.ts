import assert from "node:assert/strict";
import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import test from "node:test";
import { runDev } from "../src/commands/dev";
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

function createFakeChild(): ChildProcess {
  const emitter = new EventEmitter() as ChildProcess;
  (emitter as any).exitCode = null;
  (emitter as any).signalCode = null;
  (emitter as any).kill = () => true;
  return emitter;
}

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

test("runDev restarts after crash exit code", async () => {
  const children: ChildProcess[] = [];
  let startCalls = 0;
  let stopCalls = 0;
  const infos: string[] = [];
  const signals: Record<string, () => void> = {};

  const watcher = {
    on(_event: "all", _listener: () => void) {},
    async close() {},
  };

  await runDev(createConfig(), {
    watch: () => watcher,
    startApp: () => {
      startCalls += 1;
      const child = createFakeChild();
      children.push(child);
      return child;
    },
    stopChild: async () => {
      stopCalls += 1;
    },
    setTimeoutFn: ((callback: (...args: any[]) => void) => {
      callback();
      return 1 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout,
    clearTimeoutFn: (() => {}) as typeof clearTimeout,
    now: () => Date.now(),
    onSignal: (signal, handler) => {
      signals[signal] = handler;
    },
    exit: () => {},
    info: (message) => {
      infos.push(message);
    },
    error: () => {},
  });

  assert.equal(startCalls, 1);
  children[0].emit("exit", 1, null);
  await flush();

  assert.equal(startCalls, 2);
  assert.equal(stopCalls, 1);
  assert.equal(
    infos.some((message) => message.includes("restarting application")),
    true,
  );
  assert.equal(typeof signals.SIGINT, "function");
  assert.equal(typeof signals.SIGTERM, "function");
});

test("runDev does not restart for non-restartable exit code", async () => {
  const children: ChildProcess[] = [];
  let startCalls = 0;
  const errors: string[] = [];

  await runDev(createConfig(), {
    watch: () => ({
      on() {},
      async close() {},
    }),
    startApp: () => {
      startCalls += 1;
      const child = createFakeChild();
      children.push(child);
      return child;
    },
    stopChild: async () => {},
    setTimeoutFn: setTimeout,
    clearTimeoutFn: clearTimeout,
    now: () => Date.now(),
    onSignal: () => {},
    exit: () => {},
    info: () => {},
    error: (message) => {
      errors.push(message);
    },
  });

  children[0].emit("exit", 78, null);
  await flush();

  assert.equal(startCalls, 1);
  assert.equal(
    errors.some((message) => message.includes("non-restartable exit code 78")),
    true,
  );
});

test("runDev enters crash-loop protection after configured threshold", async () => {
  const children: ChildProcess[] = [];
  let startCalls = 0;
  const errors: string[] = [];
  let nowValue = 1000;

  await runDev(
    {
      ...createConfig(),
      crashLoopWindowMs: 10_000,
      maxConsecutiveCrashRestarts: 2,
    },
    {
      watch: () => ({
        on() {},
        async close() {},
      }),
      startApp: () => {
        startCalls += 1;
        const child = createFakeChild();
        children.push(child);
        return child;
      },
      stopChild: async () => {},
      setTimeoutFn: ((callback: (...args: any[]) => void) => {
        callback();
        return 1 as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout,
      clearTimeoutFn: (() => {}) as typeof clearTimeout,
      now: () => nowValue,
      onSignal: () => {},
      exit: () => {},
      info: () => {},
      error: (message) => {
        errors.push(message);
      },
    },
  );

  children[0].emit("exit", 1, null);
  await flush();
  assert.equal(startCalls, 2);

  nowValue += 1000;
  children[1].emit("exit", 1, null);
  await flush();

  assert.equal(startCalls, 2);
  assert.equal(
    errors.some((message) => message.includes("Application crashed 2 times")),
    true,
  );
});

test("runDev restarts on source changes and handles SIGINT cleanup", async () => {
  const children: ChildProcess[] = [];
  let startCalls = 0;
  let stopCalls = 0;
  let closeCalls = 0;
  const exitCodes: number[] = [];
  const signals: Record<string, () => void> = {};
  let onAll: (() => void) | null = null;

  await runDev(createConfig(), {
    watch: () => ({
      on(_event, listener) {
        onAll = listener;
      },
      async close() {
        closeCalls += 1;
      },
    }),
    startApp: () => {
      startCalls += 1;
      const child = createFakeChild();
      children.push(child);
      return child;
    },
    stopChild: async () => {
      stopCalls += 1;
    },
    setTimeoutFn: ((callback: (...args: any[]) => void) => {
      callback();
      return 1 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout,
    clearTimeoutFn: (() => {}) as typeof clearTimeout,
    now: () => Date.now(),
    onSignal: (signal, handler) => {
      signals[signal] = handler;
    },
    exit: (code) => {
      exitCodes.push(code);
    },
    info: () => {},
    error: () => {},
  });

  onAll?.();
  await flush();
  assert.equal(startCalls, 2);

  signals.SIGINT?.();
  await flush();
  assert.equal(closeCalls, 1);
  assert.equal(stopCalls >= 2, true);
  assert.deepEqual(exitCodes, [130]);
});

test("runDev handles SIGTERM cleanup with exit code 143", async () => {
  const signals: Record<string, () => void> = {};
  const exitCodes: number[] = [];

  await runDev(createConfig(), {
    watch: () => ({
      on() {},
      async close() {},
    }),
    startApp: () => createFakeChild(),
    stopChild: async () => {},
    setTimeoutFn: setTimeout,
    clearTimeoutFn: clearTimeout,
    now: () => Date.now(),
    onSignal: (signal, handler) => {
      signals[signal] = handler;
    },
    exit: (code) => {
      exitCodes.push(code);
    },
    info: () => {},
    error: () => {},
  });

  signals.SIGTERM?.();
  await flush();
  assert.deepEqual(exitCodes, [143]);
});

test("runDev schedules restart on child process error when not stopping", async () => {
  const children: ChildProcess[] = [];
  let startCalls = 0;
  const infos: string[] = [];

  await runDev(createConfig(), {
    watch: () => ({
      on() {},
      async close() {},
    }),
    startApp: () => {
      startCalls += 1;
      const child = createFakeChild();
      children.push(child);
      return child;
    },
    stopChild: async () => {},
    setTimeoutFn: ((callback: (...args: any[]) => void) => {
      callback();
      return 1 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout,
    clearTimeoutFn: (() => {}) as typeof clearTimeout,
    now: () => Date.now(),
    onSignal: () => {},
    exit: () => {},
    info: (message) => {
      infos.push(message);
    },
    error: () => {},
  });

  children[0].emit("error", new Error("spawn failed"));
  await flush();
  assert.equal(startCalls, 2);
  assert.equal(
    infos.some((message) => message.includes("App process failed to start")),
    true,
  );
});

test("runDev debounces restart and clears previous timeout", async () => {
  const children: ChildProcess[] = [];
  let startCalls = 0;
  let stopCalls = 0;
  let timeoutId = 0;
  const timers = new Map<number, () => void>();
  const cleared: number[] = [];

  await runDev(createConfig(), {
    watch: () => ({
      on() {},
      async close() {},
    }),
    startApp: () => {
      startCalls += 1;
      const child = createFakeChild();
      children.push(child);
      return child;
    },
    stopChild: async () => {
      stopCalls += 1;
    },
    setTimeoutFn: ((callback: (...args: any[]) => void) => {
      timeoutId += 1;
      timers.set(timeoutId, callback);
      return timeoutId as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout,
    clearTimeoutFn: ((id: ReturnType<typeof setTimeout>) => {
      const numeric = id as unknown as number;
      cleared.push(numeric);
      timers.delete(numeric);
    }) as typeof clearTimeout,
    now: () => Date.now(),
    onSignal: () => {},
    exit: () => {},
    info: () => {},
    error: () => {},
  });

  children[0].emit("exit", 1, null);
  children[0].emit("exit", 1, null);

  const latest = Math.max(...timers.keys());
  timers.get(latest)?.();
  await flush();

  assert.equal(startCalls, 2);
  assert.equal(stopCalls, 1);
  assert.equal(cleared.length >= 1, true);
});
