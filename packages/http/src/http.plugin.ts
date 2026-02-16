import {
  type ApplicationContext,
  type ModuleDefinition,
  type Plugin,
  ConsoleLogger,
  definePlugin,
} from "@trinacria/core";

import { Router } from "./routing/router";
import { HTTP_CONTROLLER_KIND } from "./controller/kind";
import { HttpServer } from "./server/http-server";
import { HttpMiddleware } from "./middleware/middleware-definition";

export interface HttpPluginOptions {
  port?: number;
  host?: string;
  middlewares?: HttpMiddleware[];
}

export function createHttpPlugin(options: HttpPluginOptions = {}): Plugin {
  const { port = 3000, host = "0.0.0.0", middlewares = [] } = options;

  const logger = new ConsoleLogger("plugin:http");

  let router: Router | null = null;
  let server: HttpServer | null = null;

  return definePlugin({
    name: "plugin:http",

    async onInit(app: ApplicationContext): Promise<void> {
      router = new Router();

      const providers = app.getProvidersByKind(HTTP_CONTROLLER_KIND);

      for (const provider of providers) {
        const controller = await app.resolve(provider.token);
        const routes = controller.routes();

        for (const route of routes) {
          logger.info(
            `Registering route: [${route.method}] ${route.path} (${controller.constructor.name})`,
          );

          router.register(route);
        }
      }

      server = new HttpServer(router, {
        globalMiddlewares: middlewares,
      });

      server.listen(port, host);

      logger.info(`HTTP server started on http://${host}:${port}`);
    },

    async onModuleRegistered(
      _module: ModuleDefinition,
      app: ApplicationContext,
    ): Promise<void> {
      if (!router) return;

      const providers = app.getProvidersByKind(HTTP_CONTROLLER_KIND);

      for (const provider of providers) {
        const controller = await app.resolve(provider.token);
        const routes = controller.routes();

        for (const route of routes) {
          logger.info(
            `Registering route (runtime): [${route.method}] ${route.path} (${controller.constructor.name})`,
          );

          router.register(route);
        }
      }
    },

    async onDestroy(): Promise<void> {
      if (!server) return;

      logger.info("Shutting down HTTP server...");

      await server.close();

      server = null;
      router = null;

      logger.info("HTTP server stopped");
    },
  });
}
