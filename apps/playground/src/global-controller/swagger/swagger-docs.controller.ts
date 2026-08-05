import { createToken } from "@trinacria/core";
import { SwaggerUiController } from "@trinacria/http";
import type { ConfigService } from "../../global-service/config.service";

export const SWAGGER_DOCS_CONTROLLER = createToken<SwaggerDocsController>(
  "SWAGGER_DOCS_CONTROLLER",
);

export class SwaggerDocsController extends SwaggerUiController {
  constructor(config: ConfigService) {
    super({
      title: "Trinacria Playground API Docs",
      enabled: () => config.get("OPENAPI_ENABLED"),
      basicAuth: {
        username: config.get("SWAGGER_DOCS_USERNAME"),
        password: config.get("SWAGGER_DOCS_PASSWORD"),
        realm: "Trinacria Docs",
      },
    });
  }
}
