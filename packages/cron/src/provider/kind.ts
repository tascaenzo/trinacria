import { createProviderKind } from "@trinacria/core";
import type { CronJobProvider } from "../contracts";

/**
 * ProviderKind marker used by the cron plugin to discover job providers.
 */
export const CRON_JOB_PROVIDER_KIND =
  createProviderKind<CronJobProvider>("cron:job-provider");
