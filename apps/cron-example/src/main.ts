import { ConsoleLogger, TrinacriaApp, valueProvider } from "@trinacria/core";
import { createCronPlugin } from "@trinacria/cron";
import { CONFIG_SERVICE, ConfigService } from "./config.service";
import { CronModule } from "./modules/cron/cron.module";

async function bootstrap() {
  const app = new TrinacriaApp();
  const configService = new ConfigService();
  const config = configService.getAll();
  const logger = new ConsoleLogger("cron-example");

  app.registerGlobalProvider(valueProvider(CONFIG_SERVICE, configService));

  if (config.CRON_ENABLED) {
    app.use(
      createCronPlugin({
        cronTickMs: config.CRON_TICK_MS,
        onError: (error, job) => {
          logger.error(`Cron job error: ${job.name}`, error);
        },
        onEvent: (event) => {
          logger.info(
            `Cron event job=${event.jobName} status=${event.status} attempts=${event.attempts} durationMs=${event.durationMs}`,
          );
        },
      }),
    );

    await app.registerModule(CronModule);
    logger.info("Cron plugin enabled");
  } else {
    logger.warn("Cron disabled (CRON_ENABLED=false)");
  }

  await app.start();
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
