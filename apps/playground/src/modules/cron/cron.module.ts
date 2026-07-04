import { classProvider, defineModule } from "@trinacria/core";
import { cronProvider } from "@trinacria/cron";
import { CONFIG_SERVICE } from "../../global-service/config.service";
import { PRISMA_SERVICE } from "../../global-service/prisma.service";
import { CronLockService } from "./cron-lock.service";
import { CRON_LOCK_SERVICE, PLAYGROUND_CRON_JOB_PROVIDER } from "./cron.tokens";
import { PlaygroundCronJobsProvider } from "./playground-cron-jobs.provider";

export const CronModule = defineModule({
  name: "CronModule",
  providers: [
    classProvider(CRON_LOCK_SERVICE, CronLockService, [PRISMA_SERVICE]),
    cronProvider(PLAYGROUND_CRON_JOB_PROVIDER, PlaygroundCronJobsProvider, [
      PRISMA_SERVICE,
      CONFIG_SERVICE,
      CRON_LOCK_SERVICE,
    ]),
  ],
  exports: [PLAYGROUND_CRON_JOB_PROVIDER, CRON_LOCK_SERVICE],
});
