import {
  TrinacriaApp,
  classProvider,
  valueProvider,
} from "@trinacria/core";
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
  type SecurityHeadersPreset,
} from "@trinacria/http";
import {
  CONFIG_VALIDATION_EXIT_CODE,
  APP_CONFIG,
  type RuntimeEnv,
  loadAppConfig,
} from "./global-service/app-config.service";
import { PrismaService } from "./global-service/prisma.service";
import { PRISMA_SERVICE } from "./global-service/prisma.service";

async function bootstrap() {
  const app = new TrinacriaApp();
  const config = loadAppConfig();
  const securityPreset = resolveSecurityPreset(config.NODE_ENV);
  const securityHeadersMiddleware = createSecurityHeadersBuilder()
    .preset(securityPreset)
    .trustProxy(config.TRUST_PROXY)
    .build();
  const isProduction = config.NODE_ENV === "production";
  const corsOrigins =
    config.CORS_ALLOWED_ORIGINS.length > 0 ? config.CORS_ALLOWED_ORIGINS : "*";

  app.registerGlobalProvider(valueProvider(APP_CONFIG, config));
  app.registerGlobalProvider(classProvider(PRISMA_SERVICE, PrismaService));

  app.use(
    createHttpPlugin({
      port: config.PORT,
      host: config.HOST,
      middlewares: [
        requestId(),
        requestLogger({ includeUserAgent: !isProduction }),
        cors({
          origin: corsOrigins,
          credentials: true,
          methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
        }),
        rateLimit({
          windowMs: 60_000,
          max: isProduction ? 240 : 2_000,
          trustProxy: config.TRUST_PROXY,
        }),
        requestTimeout({ timeoutMs: 15_000 }),
        securityHeadersMiddleware,
      ],
    }),
  );

  await app.registerModule(AuthModule);
  await app.registerModule(UserModule);

  await app.start();
}

bootstrap().catch((error) => {
  if (
    error instanceof Error &&
    error.message.startsWith("Invalid environment configuration:")
  ) {
    console.error(error.message);
    process.exit(CONFIG_VALIDATION_EXIT_CODE);
  }

  console.error(error);
  process.exit(1);
});

function resolveSecurityPreset(nodeEnv: RuntimeEnv): SecurityHeadersPreset {
  if (nodeEnv === "production") {
    return "production";
  }

  if (nodeEnv === "staging") {
    return "staging";
  }

  return "development";
}
