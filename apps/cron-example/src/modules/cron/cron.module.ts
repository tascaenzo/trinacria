import { defineModule } from "@trinacria/core";
import { cronProvider } from "@trinacria/cron";
import { CONFIG_SERVICE } from "../../config.service";
import { ExampleCronJobsProvider } from "./example-cron-jobs.provider";
import { CRON_EXAMPLE_JOBS_PROVIDER } from "./cron.tokens";

export const CronModule = defineModule({
  name: "CronModule",
  providers: [
    cronProvider(CRON_EXAMPLE_JOBS_PROVIDER, ExampleCronJobsProvider, [
      CONFIG_SERVICE,
    ]),
  ],
  exports: [CRON_EXAMPLE_JOBS_PROVIDER],
});
