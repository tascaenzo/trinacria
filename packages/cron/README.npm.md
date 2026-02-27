# @trinacria/cron

`@trinacria/cron` adds scheduled job execution to Trinacria.

It provides:

- interval jobs
- cron-expression jobs (5-field format)
- overlap protection
- runtime scheduler rebuild on module changes

## Install

```bash
npm i @trinacria/cron @trinacria/core
```

## Quick start

```ts
import { TrinacriaApp, createToken, defineModule } from "@trinacria/core";
import { createCronPlugin, cronProvider, type CronJobProvider } from "@trinacria/cron";

const JOBS = createToken<CronJobProvider>("JOBS");

class AppJobs implements CronJobProvider {
  jobs() {
    return [
      {
        name: "heartbeat",
        schedule: { type: "interval", everyMs: 10_000 },
        run: async () => {
          console.log("tick");
        },
      },
    ];
  }
}

const JobsModule = defineModule({
  name: "JobsModule",
  providers: [cronProvider(JOBS, AppJobs)],
  exports: [JOBS],
});

const app = new TrinacriaApp();
app.use(createCronPlugin({ cronTickMs: 1_000 }));
await app.registerModule(JobsModule);
await app.start();
```

## Links

- Repository: [https://github.com/tascaenzo/trinacria](https://github.com/tascaenzo/trinacria)
- Docs: `docs/en/0005-cron.md`
