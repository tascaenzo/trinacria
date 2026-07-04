import { createToken } from "@trinacria/core";
import type { CronJobProvider } from "@trinacria/cron";

export const CRON_EXAMPLE_JOBS_PROVIDER = createToken<CronJobProvider>(
  "CRON_EXAMPLE_JOBS_PROVIDER",
);
