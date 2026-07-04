import type { CronJobDefinition, CronJobProvider } from "@trinacria/cron";
import { ConsoleLogger } from "@trinacria/core";
import { PrismaService } from "../../global-service/prisma.service";
import { ConfigService } from "../../global-service/config.service";
import { CronLockService } from "./cron-lock.service";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Playground provider used to demonstrate cron features:
 * - runOnInit
 * - overlap protection
 * - error handling hooks
 */
export class PlaygroundCronJobsProvider implements CronJobProvider {
  private readonly logger = new ConsoleLogger("playground:cron-jobs");
  private unstableRunCount = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly cronLockService: CronLockService,
  ) {}

  jobs(): readonly CronJobDefinition[] {
    return [
      {
        name: "playground:users-snapshot",
        schedule: { type: "interval", everyMs: 60_000 },
        runOnInit: true,
        allowConcurrent: false,
        run: async ({ scheduledAt }) => {
          const users = await this.prisma.user.count();
          this.logger.info(
            `[users-snapshot] scheduledAt=${scheduledAt.toISOString()} users=${users}`,
          );
        },
      },
      {
        name: "playground:overlap-guard-demo",
        schedule: { type: "interval", everyMs: 5_000 },
        allowConcurrent: false,
        run: async () => {
          // Deliberately slower than interval to show skip-on-overlap behavior.
          await wait(8_000);
          this.logger.info("[overlap-guard-demo] completed");
        },
      },
      {
        name: "playground:unstable-task",
        schedule: { type: "interval", everyMs: 20_000 },
        run: async () => {
          this.unstableRunCount += 1;

          if (this.unstableRunCount % 3 === 0) {
            throw new Error(
              "Simulated intermittent cron failure in playground",
            );
          }

          this.logger.info(
            `[unstable-task] run=${this.unstableRunCount} env=${this.config.get("ENV")}`,
          );
        },
      },
      {
        name: "playground:lock-cleanup",
        schedule: { type: "interval", everyMs: 120_000 },
        run: async () => {
          const removed = await this.cronLockService.cleanupExpired();
          if (removed > 0) {
            this.logger.info(`[lock-cleanup] removed_expired_locks=${removed}`);
          }
        },
      },
    ];
  }
}
