import {
  TrinacriaApp,
  classProvider,
  valueProvider,
} from "@trinacria/core";
import {
  cors,
  createHttpPlugin,
  createSecurityHeadersBuilder,
  rateLimit,
  requestId,
  requestLogger,
  requestTimeout,
} from "@trinacria/http";
import {
  CONFIG_SERVICE,
  ConfigService,
} from "./global/config.service";
import { PrismaService, PRISMA_SERVICE } from "./global/prisma.service";
import { registerGlobalControllers } from "./global/register-global-controllers";
import { UsersModule } from "./modules/users/users.module";

async function bootstrap() {
  const app = new TrinacriaApp();
  const configService = new ConfigService();
  const config = configService.getAll();
  const isProduction = config.ENV === "production";
  const corsOrigins = config.CORS_ALLOWED_ORIGINS;
  const securityHeadersMiddleware = createSecurityHeadersBuilder()
    .preset(config.ENV)
    .trustProxy(false)
    .build();

  app.registerGlobalProvider(valueProvider(CONFIG_SERVICE, configService));
  app.registerGlobalProvider(
    classProvider(PRISMA_SERVICE, PrismaService, [CONFIG_SERVICE]),
  );
  registerGlobalControllers(app, configService);

  app.use(
    createHttpPlugin({
      host: config.HOST,
      port: config.PORT,
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
      openApi: config.OPENAPI_ENABLED
        ? {
            enabled: true,
            title: "API Prisma PostgreSQL Example",
            version: "1.0.0",
          }
        : undefined,
    }),
  );

  await app.registerModule(UsersModule);
  await app.start();
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
