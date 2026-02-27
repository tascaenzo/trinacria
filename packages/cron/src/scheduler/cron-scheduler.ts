import type { BaseLogger } from "@trinacria/core";

import { matchesCronExpression, parseCronExpression } from "./cron-expression";
import type {
  CronExecutionContext,
  CronJobDefinition,
  CronJobRunEvent,
  CronJobLockHooks,
  CronJobRunLock,
  CronJobRunResult,
  CronRetryPolicy,
} from "../contracts";

interface CronTimerState {
  readonly stop: () => void;
}

interface CronSchedulerOptions {
  readonly logger: BaseLogger;
  readonly cronTickMs: number;
  readonly onError?: (error: unknown, job: CronJobDefinition) => void;
  readonly onEvent?: (event: CronJobRunEvent) => void;
  readonly lock?: CronJobLockHooks;
  readonly retry?: CronRetryPolicy;
  readonly lockRenewIntervalMs: number;
}

interface TrackedJob {
  readonly definition: CronJobDefinition;
  readonly trigger: (
    scheduledAt: Date,
    options?: { propagateError?: boolean },
  ) => Promise<void>;
}

/**
 * Runtime scheduler core responsible for validation, scheduling and execution.
 */
export class CronScheduler {
  private readonly timers: CronTimerState[] = [];
  private readonly inFlight = new Set<Promise<void>>();

  constructor(private readonly options: CronSchedulerOptions) {
    if (
      !Number.isFinite(options.lockRenewIntervalMs) ||
      !Number.isInteger(options.lockRenewIntervalMs) ||
      options.lockRenewIntervalMs <= 0
    ) {
      throw new Error(
        "Invalid lockRenewIntervalMs: expected a positive integer",
      );
    }
  }

  /**
   * Replaces the active schedule atomically:
   * existing timers are stopped, new jobs are validated and then scheduled.
   */
  async replaceJobs(jobs: readonly CronJobDefinition[]): Promise<void> {
    this.stopAllTimers();

    const trackedJobs = jobs.map((job) => {
      this.validateJob(job);
      return {
        definition: job,
        trigger: this.createSafeRunner(job),
      } satisfies TrackedJob;
    });

    try {
      for (const tracked of trackedJobs) {
        this.scheduleJob(tracked);
        if (tracked.definition.runOnInit) {
          await tracked.trigger(new Date(), { propagateError: true });
        }
      }
    } catch (error) {
      // If bootstrap/rebuild fails mid-scheduling, rollback timers to avoid leaks.
      this.stopAllTimers();
      throw error;
    }

    this.options.logger.info(`Scheduled cron jobs: ${trackedJobs.length}`);
  }

  async stop(): Promise<void> {
    this.stopAllTimers();
    await Promise.allSettled(Array.from(this.inFlight));
    this.options.logger.info("Cron scheduler stopped");
  }

  private stopAllTimers(): void {
    for (const timer of this.timers) {
      timer.stop();
    }
    this.timers.length = 0;
  }

  private createSafeRunner(
    job: CronJobDefinition,
  ): (
    scheduledAt: Date,
    options?: { propagateError?: boolean },
  ) => Promise<void> {
    let running = false;

    return async (scheduledAt: Date, options) => {
      const context: CronExecutionContext = {
        scheduledAt,
        startedAt: new Date(),
      };

      if (!job.allowConcurrent && running) {
        this.options.logger.warn(`Skipping overlapping cron job: ${job.name}`);
        const result: CronJobRunResult = {
          status: "skipped-overlap",
          attempts: 0,
        };
        await this.safeAfterRun(job, context, result);
        await this.safeEmitEvent(job, context, result);
        return;
      }

      running = true;
      let propagatedError: unknown;

      const runPromise = (async () => {
        let acquiredLock: CronJobRunLock | null = null;
        let runError: unknown;
        let releaseError: unknown;
        let attempts = 0;
        let stopLockRenewal: (() => void) | undefined;
        let renewError: unknown;

        try {
          acquiredLock = await this.tryAcquireLock(job, context);
          if (!acquiredLock) {
            return;
          }

          stopLockRenewal = this.startLockRenewal(
            job,
            acquiredLock,
            (error) => {
              if (!renewError) {
                renewError = error;
              }
            },
          );
          attempts = await this.runWithRetry(job, context);
          if (renewError) {
            throw renewError;
          }
        } catch (error) {
          runError = error;
          propagatedError = error;
          this.options.logger.error(`Cron job failed: ${job.name}`, error);
        } finally {
          stopLockRenewal?.();

          if (acquiredLock) {
            try {
              await acquiredLock.release();
            } catch (error) {
              releaseError = error;
              this.options.logger.error(
                `Failed to release cron lock for job: ${job.name}`,
                error,
              );
            }
          }

          const result: CronJobRunResult = runError
            ? {
                status: "error",
                error: runError,
                releaseError,
                attempts,
              }
            : {
                status: acquiredLock ? "success" : "skipped-lock",
                releaseError,
                attempts,
              };
          await this.safeAfterRun(job, context, result);
          await this.safeEmitEvent(job, context, result);

          running = false;
        }
      })();

      this.inFlight.add(runPromise);
      try {
        await runPromise;
      } finally {
        this.inFlight.delete(runPromise);
      }

      if (options?.propagateError) {
        if (propagatedError) {
          throw propagatedError;
        }
      }
    };
  }

  private async tryAcquireLock(
    job: CronJobDefinition,
    context: CronExecutionContext,
  ): Promise<CronJobRunLock | null> {
    const beforeRun = this.options.lock?.onBeforeRun;
    if (!beforeRun) {
      return {
        release: () => {},
      };
    }

    const lock = await beforeRun(job, context);
    if (lock) {
      return lock;
    }

    await this.options.lock?.onLockNotAcquired?.(job, context);
    this.options.logger.debug(`Lock not acquired for cron job: ${job.name}`);
    return null;
  }

  private async runWithRetry(
    job: CronJobDefinition,
    context: CronExecutionContext,
  ): Promise<number> {
    const policy = resolveRetryPolicy(job.retry, this.options.retry);

    let attempt = 0;
    while (attempt < policy.maxAttempts) {
      attempt += 1;
      try {
        await job.run(context);
        return attempt;
      } catch (error) {
        this.options.onError?.(error, job);

        if (attempt >= policy.maxAttempts) {
          throw error;
        }

        const delayMs = computeRetryDelayMs(attempt, policy);
        this.options.logger.warn(
          `Retrying cron job "${job.name}" attempt ${attempt + 1}/${policy.maxAttempts} in ${delayMs}ms`,
        );
        await wait(delayMs);
      }
    }

    return attempt;
  }

  private startLockRenewal(
    job: CronJobDefinition,
    lock: CronJobRunLock,
    onRenewError: (error: unknown) => void,
  ): (() => void) | undefined {
    if (!lock.renew) {
      return undefined;
    }

    const timer = setInterval(() => {
      // Renewal failures are surfaced through logger + onError callback.
      void Promise.resolve()
        .then(() => lock.renew?.())
        .catch((error) => {
          onRenewError(error);
          this.options.logger.error(
            `Failed to renew cron lock for job: ${job.name}`,
            error,
          );
          this.options.onError?.(error, job);
        });
    }, this.options.lockRenewIntervalMs);

    return () => clearInterval(timer);
  }

  private async safeAfterRun(
    job: CronJobDefinition,
    context: CronExecutionContext,
    result: CronJobRunResult,
  ): Promise<void> {
    try {
      await this.options.lock?.onAfterRun?.(job, context, result);
    } catch (error) {
      this.options.logger.error(
        `Cron onAfterRun hook failed for job: ${job.name}`,
        error,
      );
    }
  }

  private async safeEmitEvent(
    job: CronJobDefinition,
    context: CronExecutionContext,
    result: CronJobRunResult,
  ): Promise<void> {
    if (!this.options.onEvent) {
      return;
    }

    const finishedAt = new Date();
    const event: CronJobRunEvent = {
      jobName: job.name,
      scheduledAt: context.scheduledAt,
      startedAt: context.startedAt,
      finishedAt,
      durationMs: Math.max(
        0,
        finishedAt.getTime() - context.startedAt.getTime(),
      ),
      status: result.status,
      attempts: result.attempts,
      error: result.error,
      releaseError: result.releaseError,
    };

    try {
      await this.options.onEvent(event);
    } catch (error) {
      this.options.logger.error(
        `Cron onEvent hook failed for job: ${job.name}`,
        error,
      );
    }
  }

  private scheduleJob(tracked: TrackedJob): void {
    const { definition, trigger } = tracked;

    if (definition.schedule.type === "interval") {
      const timer = setInterval(() => {
        void trigger(new Date());
      }, definition.schedule.everyMs);

      this.options.logger.info(
        `Registered interval job "${definition.name}" every ${definition.schedule.everyMs}ms`,
      );

      this.timers.push({
        stop: () => clearInterval(timer),
      });
      return;
    }

    const parsed = parseCronExpression(definition.schedule.expression);
    let lastKey: string | undefined;

    const timer = setInterval(() => {
      const now = new Date();
      if (!matchesCronExpression(parsed, now)) {
        return;
      }

      const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
      if (key === lastKey) {
        return;
      }

      lastKey = key;
      void trigger(now);
    }, this.options.cronTickMs);

    this.options.logger.info(
      `Registered cron job "${definition.name}" with expression "${definition.schedule.expression}"`,
    );

    this.timers.push({
      stop: () => clearInterval(timer),
    });
  }

  private validateJob(job: CronJobDefinition): void {
    if (!job.name || job.name.trim().length === 0) {
      throw new Error("Cron job name is required");
    }

    if (job.schedule.type === "interval") {
      if (!Number.isFinite(job.schedule.everyMs) || job.schedule.everyMs <= 0) {
        throw new Error(`Invalid interval for cron job "${job.name}"`);
      }
    } else {
      parseCronExpression(job.schedule.expression);
    }

    const policy = resolveRetryPolicy(job.retry, this.options.retry);
    if (!Number.isInteger(policy.maxAttempts) || policy.maxAttempts <= 0) {
      throw new Error(`Invalid retry.maxAttempts for cron job "${job.name}"`);
    }
    if (
      !Number.isFinite(policy.backoffMs) ||
      !Number.isFinite(policy.maxBackoffMs) ||
      !Number.isFinite(policy.multiplier) ||
      !Number.isFinite(policy.jitterMs)
    ) {
      throw new Error(`Invalid retry policy for cron job "${job.name}"`);
    }
    if (
      policy.backoffMs < 0 ||
      policy.maxBackoffMs <= 0 ||
      policy.multiplier < 1
    ) {
      throw new Error(`Invalid retry policy for cron job "${job.name}"`);
    }
    if (
      !Number.isInteger(policy.backoffMs) ||
      !Number.isInteger(policy.maxBackoffMs)
    ) {
      throw new Error(`Invalid retry policy for cron job "${job.name}"`);
    }
    if (policy.jitterMs < 0) {
      throw new Error(`Invalid retry.jitterMs for cron job "${job.name}"`);
    }
    if (!Number.isInteger(policy.jitterMs)) {
      throw new Error(`Invalid retry.jitterMs for cron job "${job.name}"`);
    }
  }
}

interface ResolvedRetryPolicy {
  readonly maxAttempts: number;
  readonly backoffMs: number;
  readonly multiplier: number;
  readonly maxBackoffMs: number;
  readonly jitterMs: number;
}

function resolveRetryPolicy(
  jobPolicy?: CronRetryPolicy,
  pluginPolicy?: CronRetryPolicy,
): ResolvedRetryPolicy {
  return {
    maxAttempts: jobPolicy?.maxAttempts ?? pluginPolicy?.maxAttempts ?? 1,
    backoffMs: jobPolicy?.backoffMs ?? pluginPolicy?.backoffMs ?? 250,
    multiplier: jobPolicy?.multiplier ?? pluginPolicy?.multiplier ?? 2,
    maxBackoffMs:
      jobPolicy?.maxBackoffMs ?? pluginPolicy?.maxBackoffMs ?? 10_000,
    jitterMs: jobPolicy?.jitterMs ?? pluginPolicy?.jitterMs ?? 0,
  };
}

function computeRetryDelayMs(
  attempt: number,
  policy: ResolvedRetryPolicy,
): number {
  const exponent = Math.max(0, attempt - 1);
  const backoff = Math.min(
    policy.maxBackoffMs,
    policy.backoffMs * Math.pow(policy.multiplier, exponent),
  );
  const jitter =
    policy.jitterMs > 0 ? Math.floor(Math.random() * (policy.jitterMs + 1)) : 0;
  return backoff + jitter;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
