import { TrinacriaApp } from "@trinacria/core";
import { UserModule } from "./modules/users/user.module";
import { createHttpPlugin, HttpMiddleware } from "@trinacria/http";

export const requestLogger: HttpMiddleware = async (ctx, next) => {
  const start = Date.now();

  const result = await next(); // aspetta controller

  const duration = Date.now() - start;

  const { method, url } = ctx.req;
  const status = ctx.res.statusCode;

  console.log(`${method} ${url} → ${status} (${duration}ms)`);

  return result; // IMPORTANTISSIMO
};

async function bootstrap() {
  const app = new TrinacriaApp();

  app.use(createHttpPlugin({ port: 5000, middlewares: [requestLogger] }));

  await app.registerModule(UserModule);

  app.start();
}

bootstrap();
