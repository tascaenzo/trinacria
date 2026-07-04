import {
  classProvider,
  type DependencyList,
  type Token,
} from "@trinacria/core";
import { CRON_JOB_PROVIDER_KIND } from "./kind";
import type { CronJobProvider } from "../contracts";

/**
 * Registers a provider that exposes cron job definitions.
 */
export function cronProvider<T extends CronJobProvider>(
  token: Token<T>,
  useClass: new (...args: any[]) => T,
  deps?: DependencyList,
) {
  return classProvider(token, useClass, deps, CRON_JOB_PROVIDER_KIND);
}
