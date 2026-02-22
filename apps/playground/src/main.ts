import { TrinacriaApp, classProvider, valueProvider } from "@trinacria/core";
import { AuthModule } from "./modules/auth/auth.module";
import { UserModule } from "./modules/users/user.module";
import {
  cors,
  createHttpPlugin,
  createSecurityHeadersBuilder,
  rateLimit,
  requestId,
  requestLogger,
  requestTimeout,
} from "@trinacria/http";
import { CONFIG_SERVICE, ConfigService } from "./global-service/config.service";
import { registerGlobalControllers } from "./global-controller/register-global-controllers";
import { PrismaService } from "./global-service/prisma.service";
import { PRISMA_SERVICE } from "./global-service/prisma.service";
import { withSecuritySchemes } from "./bootstrap/bootstrap.helpers";

async function bootstrap() {
  const app = new TrinacriaApp();
  const configService = new ConfigService();
  const config = configService.getAll();
  const securityHeadersMiddleware = createSecurityHeadersBuilder()
    .preset(config.ENV)
    .trustProxy(false)
    .build();
  const isProduction = config.ENV === "production";
  const corsOrigins = configService.get("CORS_ALLOWED_ORIGINS");
  app.registerGlobalProvider(valueProvider(CONFIG_SERVICE, configService));

  /**
   * Global providers are available across modules without importing a dedicated
   * module. Playground keeps infra primitives (config/db) in global scope.
   */
  app.registerGlobalProvider(classProvider(PRISMA_SERVICE, PrismaService));
  registerGlobalControllers(app, configService);

  app.use(
    createHttpPlugin({
      port: config.PORT,
      host: config.HOST,
      middlewares: [
        requestId(),
        requestLogger({ includeUserAgent: !isProduction }),
        cors({
          origin: corsOrigins.length > 0 ? corsOrigins : "*",
          credentials: true,
          methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
        }),
        rateLimit({
          windowMs: 60_000,
          max: isProduction ? 240 : 2_000,
          trustProxy: false,
        }),
        requestTimeout({ timeoutMs: 15_000 }),
        securityHeadersMiddleware,
      ],
      /**
       * The core HTTP plugin generates only the OpenAPI JSON.
       * UI clients (Swagger/Scalar/etc.) are optional app-level concerns.
       */
      openApi: config.OPENAPI_ENABLED
        ? {
            enabled: true,
            title: "Trinacria Playground API",
            version: "1.0.0",
            description:
              "Playground API used to test Trinacria modules, middleware, auth, and database integration.",
            transformDocument: withSecuritySchemes,
          }
        : undefined,
    }),
  );

  await app.registerModule(AuthModule);
  await app.registerModule(UserModule);

  await app.start();
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
