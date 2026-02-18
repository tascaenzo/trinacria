import { TrinacriaApp } from "@trinacria/core";
import { UserModule } from "./modules/users/user.module";
import { createHttpPlugin } from "@trinacria/http";
import {
  CONFIG_VALIDATION_EXIT_CODE,
  loadAppConfig,
} from "./config/app-config";

async function bootstrap() {
  const app = new TrinacriaApp();
  const config = loadAppConfig();

  app.use(
    createHttpPlugin({
      port: config.PORT,
      host: config.HOST,
      middlewares: [],
    }),
  );

  await app.registerModule(UserModule);

  await app.start();
}

bootstrap().catch((error) => {
  if (error instanceof Error && error.message.startsWith("Invalid environment configuration:")) {
    console.error(error.message);
    process.exit(CONFIG_VALIDATION_EXIT_CODE);
  }

  console.error(error);
  process.exit(1);
});
