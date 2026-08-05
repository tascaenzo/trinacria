import assert from "node:assert/strict";
import test from "node:test";
import {
  createToken,
  defineModule,
  type Token,
  TrinacriaApp,
} from "../../core/src";

import {
  type CronJobDefinition,
  type CronJobProvider,
  createCronPlugin,
  cronProvider,
} from "../src";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withSilencedOutput<T>(run: () => Promise<T> | T): Promise<T> {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};

  return Promise.resolve()
    .then(() => run())
    .finally(() => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    });
}

function createJobProviderModule(
  name: string,
  token: Token<CronJobProvider>,
  jobs: readonly CronJobDefinition[],
) {
  class JobProvider implements CronJobProvider {
    jobs() {
      return jobs;
    }
  }

  return defineModule({
    name,
    providers: [cronProvider(token, JobProvider)],
    exports: [token],
  });
}

test("interval jobs run and stop at shutdown", async () => {
  await withSilencedOutput(async () => {
    let runs = 0;

    const JOB_TOKEN = createToken<CronJobProvider>("INTERVAL_JOB_PROVIDER");
    const module = createJobProviderModule("IntervalJobModule", JOB_TOKEN, [
      {
        name: "heartbeat",
        schedule: { type: "interval", everyMs: 15 },
        run: () => {
          runs += 1;
        },
      },
    ]);

    const app = new TrinacriaApp();
    app.use(createCronPlugin());
    await app.registerModule(module);
    await app.start();

    await wait(80);
    assert.ok(runs >= 2, `Expected at least 2 runs, got ${runs}`);

    await app.shutdown();
    const runsAtShutdown = runs;
    await wait(60);
    assert.equal(runs, runsAtShutdown);
  });
});

test("runtime module unregister removes scheduled jobs", async () => {
  await withSilencedOutput(async () => {
    let runs = 0;

    const JOB_TOKEN = createToken<CronJobProvider>("RUNTIME_JOB_PROVIDER");
    const module = createJobProviderModule("RuntimeJobModule", JOB_TOKEN, [
      {
        name: "runtime-task",
        schedule: { type: "interval", everyMs: 10 },
        run: () => {
          runs += 1;
        },
      },
    ]);

    const app = new TrinacriaApp();
    app.use(createCronPlugin());
    await app.registerModule(module);
    await app.start();

    await wait(45);
    assert.ok(runs > 0);

    await app.unregisterModule(module);
    const runsBeforeWait = runs;

    await wait(50);
    assert.equal(runs, runsBeforeWait);

    await app.shutdown();
  });
});

test("invalid cron expression fails startup", async () => {
  await withSilencedOutput(async () => {
    const JOB_TOKEN = createToken<CronJobProvider>("INVALID_CRON_JOB_PROVIDER");
    const module = createJobProviderModule("InvalidCronModule", JOB_TOKEN, [
      {
        name: "broken-cron",
        schedule: { type: "cron", expression: "* * *" },
        run: () => {
          // never called
        },
      },
    ]);

    const app = new TrinacriaApp();
    app.use(createCronPlugin());
    await app.registerModule(module);

    await assert.rejects(() => app.start(), /5 fields/);
  });
});

test("runOnInit executes immediately once after scheduler build", async () => {
  await withSilencedOutput(async () => {
    let runs = 0;

    const JOB_TOKEN = createToken<CronJobProvider>("RUN_ON_INIT_PROVIDER");
    const module = createJobProviderModule("RunOnInitModule", JOB_TOKEN, [
      {
        name: "init-job",
        schedule: { type: "interval", everyMs: 1_000 },
        runOnInit: true,
        run: () => {
          runs += 1;
        },
      },
    ]);

    const app = new TrinacriaApp();
    app.use(createCronPlugin());
    await app.registerModule(module);
    await app.start();

    assert.equal(runs, 1);
    await app.shutdown();
  });
});

test("non-concurrent jobs skip overlapping executions and surface errors via callback", async () => {
  await withSilencedOutput(async () => {
    let runs = 0;
    let errors = 0;
    let inProgress = false;
    let sawOverlap = false;

    const JOB_TOKEN = createToken<CronJobProvider>("OVERLAP_GUARD_PROVIDER");
    const module = createJobProviderModule("OverlapGuardModule", JOB_TOKEN, [
      {
        name: "slow-job",
        schedule: { type: "interval", everyMs: 5 },
        allowConcurrent: false,
        run: async () => {
          if (inProgress) {
            sawOverlap = true;
          }
          inProgress = true;
          runs += 1;
          await wait(25);
          inProgress = false;
          throw new Error("expected test error");
        },
      },
    ]);

    const app = new TrinacriaApp();
    try {
      app.use(
        createCronPlugin({
          onError: () => {
            errors += 1;
          },
        }),
      );
      await app.registerModule(module);
      await app.start();

      await wait(85);

      assert.equal(sawOverlap, false);
      assert.ok(runs >= 2, `Expected at least 2 runs, got ${runs}`);
      assert.ok(
        errors >= 1,
        `Expected at least one error callback, got ${errors}`,
      );
    } finally {
      await app.shutdown();
    }
  });
});

test("lock hooks can gate single-job execution even when concurrent runs are allowed", async () => {
  await withSilencedOutput(async () => {
    let runs = 0;
    let releases = 0;
    let lockSkipped = 0;
    let inProgress = false;
    let sawOverlap = false;
    let locked = false;

    const JOB_TOKEN = createToken<CronJobProvider>("LOCK_HOOK_PROVIDER");
    const module = createJobProviderModule("LockHookModule", JOB_TOKEN, [
      {
        name: "locked-job",
        schedule: { type: "interval", everyMs: 5 },
        allowConcurrent: true,
        run: async () => {
          if (inProgress) {
            sawOverlap = true;
          }

          inProgress = true;
          runs += 1;
          await wait(20);
          inProgress = false;
        },
      },
    ]);

    const app = new TrinacriaApp();
    try {
      app.use(
        createCronPlugin({
          lock: {
            onBeforeRun: () => {
              if (locked) {
                return null;
              }

              locked = true;
              return {
                release: () => {
                  releases += 1;
                  locked = false;
                },
              };
            },
            onLockNotAcquired: () => {
              lockSkipped += 1;
            },
          },
        }),
      );
      await app.registerModule(module);
      await app.start();

      await wait(90);

      assert.equal(sawOverlap, false);
      assert.ok(runs >= 2, `Expected at least 2 runs, got ${runs}`);
      assert.ok(
        lockSkipped >= 1,
        `Expected at least 1 skipped run, got ${lockSkipped}`,
      );
      assert.ok(releases <= runs);
    } finally {
      await app.shutdown();
    }

    assert.equal(releases, runs);
  });
});

test("retry policy retries transient failures and eventually succeeds", async () => {
  await withSilencedOutput(async () => {
    let attempts = 0;
    let errors = 0;

    const JOB_TOKEN = createToken<CronJobProvider>("RETRY_SUCCESS_PROVIDER");
    const module = createJobProviderModule("RetrySuccessModule", JOB_TOKEN, [
      {
        name: "retry-success-job",
        runOnInit: true,
        schedule: { type: "interval", everyMs: 60_000 },
        run: async () => {
          attempts += 1;
          if (attempts < 3) {
            throw new Error("transient");
          }
        },
      },
    ]);

    const app = new TrinacriaApp();
    try {
      app.use(
        createCronPlugin({
          retry: {
            maxAttempts: 3,
            backoffMs: 5,
            multiplier: 1,
            jitterMs: 0,
          },
          onError: () => {
            errors += 1;
          },
        }),
      );

      await app.registerModule(module);
      await app.start();

      assert.equal(attempts, 3);
      assert.equal(errors, 2);
    } finally {
      await app.shutdown();
    }
  });
});

test("retry policy fails startup when attempts are exhausted", async () => {
  await withSilencedOutput(async () => {
    let attempts = 0;

    const JOB_TOKEN = createToken<CronJobProvider>("RETRY_FAIL_PROVIDER");
    const module = createJobProviderModule("RetryFailModule", JOB_TOKEN, [
      {
        name: "retry-fail-job",
        runOnInit: true,
        schedule: { type: "interval", everyMs: 60_000 },
        retry: {
          maxAttempts: 2,
          backoffMs: 5,
          multiplier: 1,
          jitterMs: 0,
        },
        run: async () => {
          attempts += 1;
          throw new Error("fatal");
        },
      },
    ]);

    const app = new TrinacriaApp();
    app.use(createCronPlugin());
    await app.registerModule(module);

    await assert.rejects(() => app.start(), /fatal/);
    assert.equal(attempts, 2);
  });
});

test("lock renewal runs for long-running jobs and releases once", async () => {
  await withSilencedOutput(async () => {
    let renewCalls = 0;
    let releaseCalls = 0;

    const JOB_TOKEN = createToken<CronJobProvider>("LOCK_RENEW_PROVIDER");
    const module = createJobProviderModule("LockRenewModule", JOB_TOKEN, [
      {
        name: "lock-renew-job",
        runOnInit: true,
        schedule: { type: "interval", everyMs: 60_000 },
        run: async () => {
          await wait(70);
        },
      },
    ]);

    const app = new TrinacriaApp();
    try {
      app.use(
        createCronPlugin({
          lockRenewIntervalMs: 10,
          lock: {
            onBeforeRun: () => ({
              renew: () => {
                renewCalls += 1;
              },
              release: () => {
                releaseCalls += 1;
              },
            }),
          },
        }),
      );

      await app.registerModule(module);
      await app.start();

      assert.ok(
        renewCalls >= 3,
        `Expected at least 3 renew calls, got ${renewCalls}`,
      );
      assert.equal(releaseCalls, 1);
    } finally {
      await app.shutdown();
    }
  });
});

test("lock renewal failure marks run as error and fails startup for runOnInit", async () => {
  await withSilencedOutput(async () => {
    let renewCalls = 0;

    const JOB_TOKEN = createToken<CronJobProvider>("LOCK_RENEW_FAIL_PROVIDER");
    const module = createJobProviderModule("LockRenewFailModule", JOB_TOKEN, [
      {
        name: "lock-renew-fail-job",
        runOnInit: true,
        schedule: { type: "interval", everyMs: 60_000 },
        run: async () => {
          await wait(40);
        },
      },
    ]);

    const app = new TrinacriaApp();
    app.use(
      createCronPlugin({
        lockRenewIntervalMs: 10,
        lock: {
          onBeforeRun: () => ({
            renew: () => {
              renewCalls += 1;
              throw new Error("renew failed");
            },
            release: () => {},
          }),
        },
      }),
    );
    await app.registerModule(module);

    await assert.rejects(() => app.start(), /renew failed/);
    assert.ok(renewCalls >= 1);
  });
});

test("onAfterRun hook errors are swallowed and do not crash scheduler", async () => {
  await withSilencedOutput(async () => {
    let runs = 0;

    const JOB_TOKEN = createToken<CronJobProvider>("AFTER_RUN_HOOK_PROVIDER");
    const module = createJobProviderModule("AfterRunHookModule", JOB_TOKEN, [
      {
        name: "after-run-hook-job",
        runOnInit: true,
        schedule: { type: "interval", everyMs: 10 },
        run: async () => {
          runs += 1;
        },
      },
    ]);

    const app = new TrinacriaApp();
    try {
      app.use(
        createCronPlugin({
          lock: {
            onAfterRun: () => {
              throw new Error("hook boom");
            },
          },
        }),
      );
      await app.registerModule(module);
      await app.start();

      await wait(35);
      assert.ok(runs >= 1);
    } finally {
      await app.shutdown();
    }
  });
});

test("invalid lockRenewIntervalMs throws at plugin creation", () => {
  assert.throws(
    () => createCronPlugin({ lockRenewIntervalMs: 0 }),
    /Invalid lockRenewIntervalMs/,
  );
});

test("invalid retry numeric values fail startup validation", async () => {
  await withSilencedOutput(async () => {
    const JOB_TOKEN = createToken<CronJobProvider>(
      "INVALID_RETRY_NUMERIC_PROVIDER",
    );
    const module = createJobProviderModule(
      "InvalidRetryNumericModule",
      JOB_TOKEN,
      [
        {
          name: "invalid-retry-job",
          runOnInit: true,
          schedule: { type: "interval", everyMs: 60_000 },
          retry: {
            maxAttempts: 2,
            backoffMs: Number.POSITIVE_INFINITY,
          },
          run: async () => {
            // never called
          },
        },
      ],
    );

    const app = new TrinacriaApp();
    app.use(createCronPlugin());
    await app.registerModule(module);

    await assert.rejects(() => app.start(), /Invalid retry policy/);
  });
});

test("onEvent emits structured success event", async () => {
  await withSilencedOutput(async () => {
    const events: Array<{
      status: string;
      attempts: number;
      durationMs: number;
      jobName: string;
    }> = [];

    const JOB_TOKEN = createToken<CronJobProvider>("ON_EVENT_SUCCESS_PROVIDER");
    const module = createJobProviderModule("OnEventSuccessModule", JOB_TOKEN, [
      {
        name: "on-event-success-job",
        runOnInit: true,
        schedule: { type: "interval", everyMs: 60_000 },
        run: async () => {
          await wait(10);
        },
      },
    ]);

    const app = new TrinacriaApp();
    try {
      app.use(
        createCronPlugin({
          onEvent: (event) => {
            events.push({
              status: event.status,
              attempts: event.attempts,
              durationMs: event.durationMs,
              jobName: event.jobName,
            });
          },
        }),
      );

      await app.registerModule(module);
      await app.start();

      assert.ok(events.length >= 1);
      assert.equal(events[0].jobName, "on-event-success-job");
      assert.equal(events[0].status, "success");
      assert.equal(events[0].attempts, 1);
      assert.ok(events[0].durationMs >= 0);
    } finally {
      await app.shutdown();
    }
  });
});

test("onEvent emits skipped-lock when lock is not acquired", async () => {
  await withSilencedOutput(async () => {
    const statuses: string[] = [];

    const JOB_TOKEN = createToken<CronJobProvider>(
      "ON_EVENT_SKIPPED_LOCK_PROVIDER",
    );
    const module = createJobProviderModule(
      "OnEventSkippedLockModule",
      JOB_TOKEN,
      [
        {
          name: "on-event-skipped-lock-job",
          runOnInit: true,
          schedule: { type: "interval", everyMs: 60_000 },
          run: async () => {
            // not expected
          },
        },
      ],
    );

    const app = new TrinacriaApp();
    try {
      app.use(
        createCronPlugin({
          lock: {
            onBeforeRun: () => null,
          },
          onEvent: (event) => {
            statuses.push(event.status);
          },
        }),
      );

      await app.registerModule(module);
      await app.start();

      assert.ok(statuses.includes("skipped-lock"));
    } finally {
      await app.shutdown();
    }
  });
});
