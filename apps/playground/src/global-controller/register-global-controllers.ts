import { TrinacriaApp } from "@trinacria/core";
import { httpProvider } from "@trinacria/http";
import {
  APP_CONFIG,
  type AppConfig,
} from "../global-service/app-config.service";
import {
  SWAGGER_DOCS_CONTROLLER,
  SwaggerDocsController,
} from "./swagger/swagger-docs.controller";

export function registerGlobalControllers(
  app: TrinacriaApp,
  config: AppConfig,
): void {
  if (config.OPENAPI_ENABLED) {
    app.registerGlobalProvider(
      httpProvider(SWAGGER_DOCS_CONTROLLER, SwaggerDocsController, [
        APP_CONFIG,
      ]),
    );
  }
}
