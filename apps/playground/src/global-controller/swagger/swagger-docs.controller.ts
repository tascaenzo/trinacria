import { createToken } from "@trinacria/core";
import { HttpContext, HttpController, response } from "@trinacria/http";
import fs from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../../global-service/app-config.service";

export const SWAGGER_DOCS_CONTROLLER = createToken<SwaggerDocsController>(
  "SWAGGER_DOCS_CONTROLLER",
);

export class SwaggerDocsController extends HttpController {
  constructor(private readonly config: AppConfig) {
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

  async renderDocs(ctx: HttpContext) {
    if (!this.isAuthorized(ctx.req.headers.authorization)) {
      return response(
        {
          statusCode: 401,
          message: "Authentication required",
          error: "Unauthorized",
        },
        {
          status: 401,
          headers: {
            "www-authenticate": 'Basic realm="Trinacria Docs", charset="UTF-8"',
          },
        },
      );
    }

    return response(await readSwaggerHtml(), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-security-policy": docsContentSecurityPolicy(),
      },
    });
  }

  /**
   * Basic auth is optional and enabled only when both credentials are set.
   */
  private isAuthorized(authorizationHeader: string | undefined): boolean {
    const username = this.config.SWAGGER_DOCS_USERNAME;
    const password = this.config.SWAGGER_DOCS_PASSWORD;

    if (!username && !password) {
      return true;
    }

    if (!authorizationHeader || !authorizationHeader.startsWith("Basic ")) {
      return false;
    }

    const encoded = authorizationHeader.slice("Basic ".length).trim();
    if (!encoded) {
      return false;
    }

    let decoded: string;
    try {
      decoded = Buffer.from(encoded, "base64").toString("utf8");
    } catch {
      return false;
    }

    const separator = decoded.indexOf(":");
    if (separator < 0) {
      return false;
    }

    const incomingUser = decoded.slice(0, separator);
    const incomingPassword = decoded.slice(separator + 1);
    return incomingUser === username && incomingPassword === password;
  }
}

let cachedSwaggerHtml: string | undefined;

async function readSwaggerHtml(): Promise<string> {
  if (cachedSwaggerHtml) {
    return cachedSwaggerHtml;
  }

  const candidates = [
    path.resolve(process.cwd(), "src/global-controller/swagger/docs.html"),
    path.resolve(
      process.cwd(),
      "apps/playground/src/global-controller/swagger/docs.html",
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
  // Allow Swagger UI assets from unpkg while keeping a strict default policy.
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
