import { ConsoleLogger } from "@trinacria/core";
import type { CronJobDefinition, CronJobProvider } from "@trinacria/cron";
import { ConfigService } from "../../config.service";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ExampleCronJobsProvider implements CronJobProvider {
  private readonly logger = new ConsoleLogger("cron-example:jobs");

  constructor(private readonly config: ConfigService) {}

  jobs(): readonly CronJobDefinition[] {
    const { HEARTBEAT_INTERVAL_MS } = this.config.getAll();

    return [
      {
        name: "cron-example:heartbeat",
        schedule: { type: "interval", everyMs: HEARTBEAT_INTERVAL_MS },
        runOnInit: true,
        run: ({ scheduledAt }) => {
          this.logger.info(
            `[heartbeat] scheduledAt=${scheduledAt.toISOString()} intervalMs=${HEARTBEAT_INTERVAL_MS}`,
          );
        },
      },
      {
        name: "cron-example:minute-tick",
        schedule: { type: "cron", expression: "* * * * *" },
        run: ({ scheduledAt }) => {
          this.logger.info(
            `[minute-tick] scheduledAt=${scheduledAt.toISOString()}`,
          );
        },
      },
      {
        name: "cron-example:overlap-guard-demo",
        schedule: { type: "interval", everyMs: 5_000 },
        allowConcurrent: false,
        run: async () => {
          await wait(8_000);
          this.logger.info("[overlap-guard-demo] completed");
        },
      },
    ];
  }
}
