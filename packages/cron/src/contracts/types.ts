/**
 * Execution metadata passed to each scheduled run.
 */
export interface CronExecutionContext {
  readonly scheduledAt: Date;
  readonly startedAt: Date;
}

/**
 * Handle returned by lock hooks when a run lock has been acquired.
 * The scheduler calls `release()` in a `finally` block.
 */
export interface CronJobRunLock {
  release(): Promise<void> | void;
  /**
   * Optional lock renewal hook used by long-running jobs.
   * Throwing will mark the run as failed.
   */
  renew?(): Promise<void> | void;
}

/**
 * Retry policy shared by plugin defaults and per-job override.
 */
export interface CronRetryPolicy {
  /**
   * Total attempts including the first run.
   */
  readonly maxAttempts?: number;
  /**
   * Base delay used before each retry attempt.
   */
  readonly backoffMs?: number;
  /**
   * Multiplicative factor applied to the delay at each retry.
   */
  readonly multiplier?: number;
  /**
   * Upper bound for computed retry delay.
   */
  readonly maxBackoffMs?: number;
  /**
   * Random jitter added to each retry delay (0..jitterMs).
   */
  readonly jitterMs?: number;
}

export type CronSchedule =
  | {
      readonly type: "cron";
      /**
       * Five-field cron expression: minute hour day month dayOfWeek
       */
      readonly expression: string;
    }
  | {
      readonly type: "interval";
      /**
       * Interval in milliseconds.
       */
      readonly everyMs: number;
    };

export interface CronJobDefinition {
  readonly name: string;
  readonly schedule: CronSchedule;
  readonly run: (context: CronExecutionContext) => Promise<void> | void;
  /**
   * If true, runs the job once immediately when the scheduler is rebuilt.
   */
  readonly runOnInit?: boolean;
  /**
   * If false (default), overlapping executions are skipped.
   */
  readonly allowConcurrent?: boolean;
  /**
   * Optional retry policy overriding plugin-level defaults.
   */
  readonly retry?: CronRetryPolicy;
}

/**
 * Contract implemented by providers discovered by the cron plugin.
 */
export interface CronJobProvider {
  jobs(): CronJobDefinition | readonly CronJobDefinition[];
}

export type CronJobRunStatus =
  | "success"
  | "error"
  | "skipped-lock"
  | "skipped-overlap";

/**
 * Outcome reported to lock hooks after each trigger attempt.
 */
export interface CronJobRunResult {
  readonly status: CronJobRunStatus;
  readonly error?: unknown;
  readonly releaseError?: unknown;
  readonly attempts: number;
}

/**
 * Structured event emitted at the end of each run attempt.
 */
export interface CronJobRunEvent {
  readonly jobName: string;
  readonly scheduledAt: Date;
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly durationMs: number;
  readonly status: CronJobRunStatus;
  readonly attempts: number;
  readonly error?: unknown;
  readonly releaseError?: unknown;
}

/**
 * Optional hooks used to implement distributed (or custom) locking per job run.
 * If `onBeforeRun` returns `null`, the run is skipped.
 */
export interface CronJobLockHooks {
  onBeforeRun?: (
    job: CronJobDefinition,
    context: CronExecutionContext,
  ) => Promise<CronJobRunLock | null> | CronJobRunLock | null;
  onLockNotAcquired?: (
    job: CronJobDefinition,
    context: CronExecutionContext,
  ) => Promise<void> | void;
  onAfterRun?: (
    job: CronJobDefinition,
    context: CronExecutionContext,
    result: CronJobRunResult,
  ) => Promise<void> | void;
}

/**
 * Public options accepted by `createCronPlugin`.
 */
export interface CronPluginOptions {
  /**
   * Tick interval used to evaluate cron expressions.
   */
  readonly cronTickMs?: number;
  /**
   * Called when a job execution throws.
   */
  readonly onError?: (error: unknown, job: CronJobDefinition) => void;
  /**
   * Called for each finalized run attempt (success/error/skip).
   */
  readonly onEvent?: (event: CronJobRunEvent) => void;
  /**
   * Default retry policy applied to jobs that do not override it.
   */
  readonly retry?: CronRetryPolicy;
  /**
   * Optional per-job run lock hooks.
   */
  readonly lock?: CronJobLockHooks;
  /**
   * Interval used to renew lock handles exposing `renew()`.
   */
  readonly lockRenewIntervalMs?: number;
}
