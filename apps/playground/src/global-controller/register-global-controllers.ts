import type { TrinacriaApp } from "@trinacria/core";
import { httpProvider } from "@trinacria/http";
import {
  CONFIG_SERVICE,
  type ConfigService,
} from "../global-service/config.service";
import {
  SWAGGER_DOCS_CONTROLLER,
  SwaggerDocsController,
} from "./swagger/swagger-docs.controller";

export function registerGlobalControllers(
  app: TrinacriaApp,
  config: ConfigService,
): void {
  if (config.get("OPENAPI_ENABLED")) {
    app.registerGlobalProvider(
      httpProvider(SWAGGER_DOCS_CONTROLLER, SwaggerDocsController, [
        CONFIG_SERVICE,
      ]),
    );
  }
}
