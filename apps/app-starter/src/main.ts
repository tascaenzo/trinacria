import { ConsoleLogger, TrinacriaApp } from "@trinacria/core";

async function bootstrap() {
  const app = new TrinacriaApp();
  const logger = new ConsoleLogger("app-starter");

  logger.info("Hello World");
  await app.start();
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
