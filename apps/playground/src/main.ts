import { TrinacriaApp, valueProvider } from "@trinacria/core";
import { UserModule } from "./modules/users/user.module";
import { createHttpPlugin } from "@trinacria/http";

async function bootstrap() {
  const app = new TrinacriaApp();

  app.use(createHttpPlugin({ port: 5000, middlewares: [] }));

  await app.registerModule(UserModule);

  await app.start();
}

bootstrap();
