import { createToken } from "@trinacria/core";
import { SwaggerUiController } from "@trinacria/http";
import type { ConfigService } from "../../config.service";

export const SWAGGER_DOCS_CONTROLLER = createToken<SwaggerDocsController>(
  "SWAGGER_DOCS_CONTROLLER",
);

export class SwaggerDocsController extends SwaggerUiController {
  constructor(config: ConfigService) {
    super({
      title: "API Mongoose MongoDB Docs",
      enabled: () => config.get("OPENAPI_ENABLED"),
    });
  }
}
