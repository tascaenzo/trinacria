import {
  type ApplicationContext,
  type ModuleDefinition,
  type Plugin,
  ConsoleLogger,
  definePlugin,
} from "@trinacria/core";

import { Router } from "./routing/router";
import { HTTP_CONTROLLER_KIND } from "./controller/kind";
import {
  HttpServer,
  type HttpExceptionHandler,
  type HttpServerErrorSerializer,
} from "./server/http-server";
import { HttpMiddleware } from "./middleware/middleware-definition";
import type { HttpResponseSerializer } from "./response";
import {
  buildOpenApiDocument,
  type OpenApiDocument,
  type OpenApiRouteEntry,
} from "./openapi";

export interface HttpPluginOpenApiOptions {
  enabled?: boolean;
  title: string;
  version: string;
  description?: string;
  transformDocument?: (document: OpenApiDocument) => OpenApiDocument;
  onDocumentGenerated?: (document: OpenApiDocument) => void;
}

export interface HttpPluginOptions {
  port?: number;
  host?: string;
  middlewares?: HttpMiddleware[];
  jsonBodyLimitBytes?: number;
  streamingBodyContentTypes?: string[];
  exceptionHandler?: HttpExceptionHandler;
  responseSerializer?: HttpResponseSerializer;
  /**
   * @deprecated Use `exceptionHandler`.
   */
  errorSerializer?: HttpServerErrorSerializer;
  /**
   * @deprecated Use `openApi.onDocumentGenerated`.
   */
  onRoutesRebuilt?: (routes: OpenApiRouteEntry[]) => void;
  openApi?: HttpPluginOpenApiOptions;
}

/**
 * Creates the Trinacria HTTP plugin.
 * The plugin discovers HTTP controllers by ProviderKind and registers their routes.
 */
export function createHttpPlugin(options: HttpPluginOptions = {}): Plugin {
  const {
    port = 3000,
    host = "0.0.0.0",
    middlewares = [],
    jsonBodyLimitBytes,
    streamingBodyContentTypes,
    exceptionHandler,
    responseSerializer,
    errorSerializer,
    onRoutesRebuilt,
    openApi,
  } = options;

  const logger = new ConsoleLogger("plugin:http");

  let router: Router | null = null;
  let server: HttpServer | null = null;
  const registeredControllerTokens = new Set<symbol>();

  /**
   * Resolves controller providers and registers their routes once.
   * A token guard prevents duplicate registration across runtime module updates.
   */
  async function registerControllers(app: ApplicationContext): Promise<void> {
    if (!router) return;
    const routeEntries: OpenApiRouteEntry[] = [];

    const providers = app.getProvidersByKind(HTTP_CONTROLLER_KIND);

    for (const provider of providers) {
      if (registeredControllerTokens.has(provider.token.key)) {
        continue;
      }

      const controller = await app.resolve(provider.token);
      const routes = controller.routes();

      for (const route of routes) {
        logger.info(
          `Registering route: [${route.method}] ${route.path} (${controller.constructor.name})`,
        );

        router.register(route);
        routeEntries.push({
          route,
          controllerName: controller.constructor.name,
        });
      }

      registeredControllerTokens.add(provider.token.key);
    }

    if (openApi?.enabled) {
      const baseDocument = buildOpenApiDocument({
        title: openApi.title,
        version: openApi.version,
        description: openApi.description,
        routes: routeEntries,
      });
      const document = openApi.transformDocument
        ? openApi.transformDocument(baseDocument)
        : baseDocument;
      openApi.onDocumentGenerated?.(document);
    }

    onRoutesRebuilt?.(routeEntries);
  }

  async function rebuildControllers(app: ApplicationContext): Promise<void> {
    if (!router) return;

    router.clear();
    registeredControllerTokens.clear();
    await registerControllers(app);
  }

  return definePlugin({
    name: "plugin:http",

    async onInit(app: ApplicationContext): Promise<void> {
      router = new Router();
      await rebuildControllers(app);

      server = new HttpServer(router, {
        globalMiddlewares: middlewares,
        jsonBodyLimitBytes,
        streamingBodyContentTypes,
        exceptionHandler,
        responseSerializer,
        errorSerializer,
      });

      server.listen(port, host);

      logger.info(`HTTP server started on http://${host}:${port}`);
    },

    async onModuleRegistered(
      _module: ModuleDefinition,
      app: ApplicationContext,
    ): Promise<void> {
      await rebuildControllers(app);
    },

    async onModuleUnregistered(
      _module: ModuleDefinition,
      app: ApplicationContext,
    ): Promise<void> {
      await rebuildControllers(app);
    },

    async onDestroy(): Promise<void> {
      if (!server) return;

      logger.info("Shutting down HTTP server...");

      await server.close();

      server = null;
      router = null;
      registeredControllerTokens.clear();

      logger.info("HTTP server stopped");
    },
  });
}
