import {
  ConsoleLogger,
  TrinacriaApp,
  valueProvider,
} from "@trinacria/core";
import { createEventsPlugin, RedisEventTransport } from "@trinacria/events";
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
import { REDIS_SERVICE, RedisService } from "./global/redis.service";
import { registerGlobalControllers } from "./global/register-global-controllers";
import { EventsModule } from "./modules/events/events.module";

async function bootstrap() {
  const app = new TrinacriaApp();
  const configService = new ConfigService();
  const config = configService.getAll();
  const eventsLogger = new ConsoleLogger("api-events-redis:events");
  const isProduction = config.ENV === "production";
  const corsOrigins = config.CORS_ALLOWED_ORIGINS;
  const securityHeadersMiddleware = createSecurityHeadersBuilder()
    .preset(config.ENV)
    .trustProxy(false)
    .build();

  const redisService = new RedisService(configService);
  await redisService.onInit();

  app.registerGlobalProvider(valueProvider(CONFIG_SERVICE, configService));
  app.registerGlobalProvider(valueProvider(REDIS_SERVICE, redisService));
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
            title: "API Events Redis Example",
            version: "1.0.0",
          }
        : undefined,
    }),
  );

  app.use(
    createEventsPlugin({
      transport: new RedisEventTransport({
        publisher: redisService.getPublisherClient(),
        subscriber: redisService.getSubscriberClient(),
        channel: config.REDIS_CHANNEL,
      }),
      source: "api-events-redis",
      dispatchLocalOnEmit: false,
      onListenerError: (error, envelope) => {
        eventsLogger.error(`Event listener error: ${envelope.name}`, error);
      },
    }),
  );

  await app.registerModule(EventsModule);
  await app.start();
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
