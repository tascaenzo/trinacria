# @trinacria/cron - Implementation Guide

`@trinacria/cron` is Trinacria's scheduling plugin.
It discovers cron job providers through `ProviderKind`, validates job definitions, and manages timer-based execution lifecycle.

## What this package is responsible for

- plugin lifecycle integration into `TrinacriaApp`
- cron job provider discovery through `ProviderKind`
- schedule validation (`interval` and 5-field `cron` expressions)
- runtime-safe scheduling (rebuild on module changes)
- overlap control and error handling for job executions

It does **not** include persistence, distributed locks, retries, or queue semantics.

## Directory structure

```text
packages/cron/
  src/
    cron.plugin.ts
    provider/
    scheduler/
    contracts/
    index.ts
```

## Key implementation areas

### `src/cron.plugin.ts`

- plugin entrypoint (`createCronPlugin`)
- owns lifecycle hooks (`onInit`, `onModuleRegistered`, `onModuleUnregistered`, `onDestroy`)
- loads jobs from discovered providers
- delegates scheduling runtime to `CronScheduler`

### `src/provider/`

- `kind.ts`
  - `CRON_JOB_PROVIDER_KIND` marker used for provider discovery

- `cron-provider.ts`
  - helper `cronProvider(...)` to register typed cron providers in modules

### `src/scheduler/`

- `cron-scheduler.ts`
  - runtime core for job execution
  - validates job definitions before scheduling
  - schedules timers for:
    - `interval` jobs (`everyMs`)
    - `cron` jobs (minute-level match with configurable tick)
  - overlap policy (`allowConcurrent`)
  - in-flight tracking + graceful stop (`Promise.allSettled`)

- `cron-expression.ts`
  - parser and matcher for standard five-field cron expressions:
    - `minute hour dayOfMonth month dayOfWeek`
  - supports `*`, lists, ranges, and steps (`*/5`, `1-10/2`, `1,2,3`)

### `src/contracts/`

- `types.ts`
  - public package contracts:
    - `CronJobDefinition`
    - `CronJobProvider`
    - `CronPluginOptions`
    - `CronExecutionContext`

## Runtime flow

1. Register plugin with `app.use(createCronPlugin(...))`
2. On startup (`onInit`):
   - discover providers by `CRON_JOB_PROVIDER_KIND`
   - collect job definitions
   - validate and schedule jobs via `CronScheduler.replaceJobs(...)`
3. On runtime module changes:
   - rebuild schedule from current provider set
4. On shutdown (`onDestroy`):
   - stop all timers
   - wait for running executions to settle

## Job contract and behavior

Each job requires:

- `name`
- `schedule`
  - `{ type: "interval", everyMs: number }`
  - `{ type: "cron", expression: string }`
- `run(context)`

Optional flags:

- `runOnInit`: executes once immediately after scheduling/rebuild
- `allowConcurrent`: if `false` (default), overlapping runs are skipped

Optional lock hooks (`createCronPlugin({ lock: ... })`):

- `onBeforeRun(job, context)`: return a lock handle (`{ release() }`) to run, or `null` to skip
- `onLockNotAcquired(job, context)`: called when the run is skipped because lock is unavailable
- `onAfterRun(job, context, result)`: receives run outcome (`success`, `error`, `skipped-lock`, `skipped-overlap`)

Retry policy:

- plugin-level defaults: `createCronPlugin({ retry: { ... } })`
- per-job override: `job.retry`
- fields:
  - `maxAttempts` (includes first attempt)
  - `backoffMs`
  - `multiplier`
  - `maxBackoffMs`
  - `jitterMs`

Lock renewal:

- if the acquired lock handle exposes `renew()`, scheduler calls it periodically
- interval configurable with `lockRenewIntervalMs` (default `10000`)

Telemetry:

- `onEvent(event)` receives structured run events with:
  - `jobName`, `status`, `attempts`
  - `scheduledAt`, `startedAt`, `finishedAt`, `durationMs`
  - `error` / `releaseError` when present

Execution context:

- `scheduledAt`: time when the scheduler triggered the run
- `startedAt`: actual execution start time

## Usage example

```ts
import { TrinacriaApp, createToken, defineModule } from "@trinacria/core";
import {
  createCronPlugin,
  cronProvider,
  type CronJobProvider,
} from "@trinacria/cron";

const REPORT_JOBS = createToken<CronJobProvider>("REPORT_JOBS");

class ReportJobsProvider implements CronJobProvider {
  jobs() {
    return [
      {
        name: "heartbeat",
        schedule: { type: "interval", everyMs: 10_000 },
        run: async () => {
          // work
        },
      },
      {
        name: "weekday-report",
        schedule: { type: "cron", expression: "0 9 * * 1-5" },
        run: async () => {
          // work
        },
      },
    ];
  }
}

const JobsModule = defineModule({
  name: "JobsModule",
  providers: [cronProvider(REPORT_JOBS, ReportJobsProvider)],
  exports: [REPORT_JOBS],
});

const app = new TrinacriaApp();
app.use(createCronPlugin({ cronTickMs: 1_000 }));
await app.registerModule(JobsModule);
await app.start();
```

## Distributed lock example (per job)

```ts
app.use(
  createCronPlugin({
    lock: {
      async onBeforeRun(job) {
        const handle = await redisLock.tryAcquire(`cron:${job.name}`, 30_000);
        if (!handle) return null;

        return {
          release: () => handle.release(),
        };
      },
      onLockNotAcquired(job) {
        // optional metric/log
      },
    },
  }),
);
```

## Extension points for contributors

- Add new schedule types by extending:
  - `src/contracts/types.ts`
  - `src/scheduler/cron-scheduler.ts`
- Improve cron parsing capabilities in `src/scheduler/cron-expression.ts`
- Add scheduler-level telemetry hooks in `CronScheduler` (without coupling to app domain)
- Keep plugin thin: discovery/orchestration only, execution logic in scheduler core

## Important design constraints

- provider discovery must stay `ProviderKind`-based
- plugin lifecycle must remain deterministic and rebuild-safe
- scheduler should be infrastructure-agnostic (no domain-specific logic)
- shutdown must always stop timers and settle in-flight jobs

## Tests

```bash
npm run test -w @trinacria/cron
npm run test:coverage -w @trinacria/cron
```
