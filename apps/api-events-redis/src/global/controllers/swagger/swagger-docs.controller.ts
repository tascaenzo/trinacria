import { createToken } from "@trinacria/core";
import { HttpController, response } from "@trinacria/http";
import fs from "node:fs/promises";
import path from "node:path";
import type { ConfigService } from "../../config.service";

export const SWAGGER_DOCS_CONTROLLER = createToken<SwaggerDocsController>(
  "SWAGGER_DOCS_CONTROLLER",
);

export class SwaggerDocsController extends HttpController {
  constructor(private readonly config: ConfigService) {
    super();
  }

  routes() {
    return this.router()
      .get("/docs", this.renderDocs, {
        docs: {
          excludeFromOpenApi: true,
        },
      })
      .build();
  }

  async renderDocs() {
    if (!this.config.get("OPENAPI_ENABLED")) {
      return response({ message: "OpenAPI is disabled" }, { status: 404 });
    }

    return response(await readSwaggerHtml(), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-security-policy": docsContentSecurityPolicy(),
      },
    });
  }
}

let cachedSwaggerHtml: string | undefined;

async function readSwaggerHtml(): Promise<string> {
  if (cachedSwaggerHtml) {
    return cachedSwaggerHtml;
  }

  const candidates = [
    path.resolve(process.cwd(), "src/global/controllers/swagger/docs.html"),
    path.resolve(
      process.cwd(),
      "apps/api-events-redis/src/global/controllers/swagger/docs.html",
    ),
  ];

  for (const filePath of candidates) {
    try {
      cachedSwaggerHtml = await fs.readFile(filePath, "utf8");
      return cachedSwaggerHtml;
    } catch {
      // keep trying next candidate
    }
  }

  throw new Error("Swagger docs HTML template not found.");
}

function docsContentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self' 'unsafe-inline' https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://unpkg.com",
    "img-src 'self' data: blob:",
    "font-src 'self' data: https://unpkg.com",
    "connect-src 'self'",
  ].join("; ");
}
