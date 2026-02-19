import { TrinacriaApp } from "@trinacria/core";
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
  loadAppConfig,
} from "./config/app-config";

async function bootstrap() {
  const app = new TrinacriaApp();
  const config = loadAppConfig();
  const securityPreset = resolveSecurityPreset(process.env.NODE_ENV);
  const securityHeadersMiddleware = createSecurityHeadersBuilder()
    .preset(securityPreset)
    .build();
  const env = process.env.NODE_ENV?.toLowerCase();
  const isProduction = env === "production";

  app.use(
    createHttpPlugin({
      port: config.PORT,
      host: config.HOST,
      middlewares: [
        requestId(),
        requestLogger({ includeUserAgent: !isProduction }),
        cors({
          origin: "*",
          methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
        }),
        rateLimit({
          windowMs: 60_000,
          max: isProduction ? 240 : 2_000,
        }),
        requestTimeout({ timeoutMs: 15_000 }),
        securityHeadersMiddleware,
      ],
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

function resolveSecurityPreset(
  nodeEnv: string | undefined,
): SecurityHeadersPreset {
  const env = nodeEnv?.toLowerCase();

  if (env === "production") {
    return "production";
  }

  if (env === "staging") {
    return "staging";
  }

  return "development";
}
