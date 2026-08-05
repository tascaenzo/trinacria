import { createToken } from "@trinacria/core";
import type { CronJobProvider } from "@trinacria/cron";
import type { CronLockService } from "./cron-lock.service";

export const PLAYGROUND_CRON_JOB_PROVIDER = createToken<CronJobProvider>(
  "PLAYGROUND_CRON_JOB_PROVIDER",
);

export const CRON_LOCK_SERVICE =
  createToken<CronLockService>("CRON_LOCK_SERVICE");
