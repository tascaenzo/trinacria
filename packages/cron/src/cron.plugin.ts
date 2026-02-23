import {
  ConsoleLogger,
  definePlugin,
  type ApplicationContext,
  type ModuleDefinition,
  type Plugin,
} from "@trinacria/core";

import { CRON_JOB_PROVIDER_KIND } from "./provider";
import { CronScheduler } from "./scheduler";
import type { CronJobDefinition, CronPluginOptions } from "./contracts";

/**
 * Creates a cron scheduler plugin.
 * It discovers providers tagged with `CRON_JOB_PROVIDER_KIND`.
 */
export function createCronPlugin(options: CronPluginOptions = {}): Plugin {
  const logger = new ConsoleLogger("plugin:cron");
  const scheduler = new CronScheduler({
    logger,
    cronTickMs: options.cronTickMs ?? 1000,
    onError: options.onError,
    onEvent: options.onEvent,
    retry: options.retry,
    lock: options.lock,
    lockRenewIntervalMs: options.lockRenewIntervalMs ?? 10_000,
  });

  async function rebuildJobs(app: ApplicationContext): Promise<void> {
    const jobs = await loadJobsFromProviders(app);
    await scheduler.replaceJobs(jobs);
  }

  return definePlugin({
    name: "plugin:cron",

    async onInit(app: ApplicationContext): Promise<void> {
      await rebuildJobs(app);
    },

    async onModuleRegistered(
      _module: ModuleDefinition,
      app: ApplicationContext,
    ): Promise<void> {
      await rebuildJobs(app);
    },

    async onModuleUnregistered(
      _module: ModuleDefinition,
      app: ApplicationContext,
    ): Promise<void> {
      await rebuildJobs(app);
    },

    async onDestroy(): Promise<void> {
      await scheduler.stop();
    },
  });
}

async function loadJobsFromProviders(
  app: ApplicationContext,
): Promise<CronJobDefinition[]> {
  // Discovery is delegated to ProviderKind so the plugin stays decoupled
  // from specific job provider implementations.
  const providers = app.getProvidersByKind(CRON_JOB_PROVIDER_KIND);
  const jobs: CronJobDefinition[] = [];

  for (const provider of providers) {
    const instance = await app.resolve(provider.token);
    const providedJobs = instance.jobs();
    jobs.push(...(Array.isArray(providedJobs) ? providedJobs : [providedJobs]));
  }

  return jobs;
}
