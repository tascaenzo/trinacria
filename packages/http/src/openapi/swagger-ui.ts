import { timingSafeEqual } from "node:crypto";
import fs from "node:fs/promises";
import { HttpController } from "../controller/base-controller";
import { UnauthorizedException } from "../errors";
import type { HttpMiddleware } from "../middleware";
import { response } from "../response/http-response";
import type { HttpContext } from "../server/http-context";

export type SwaggerUiAssetName =
  | "swagger-ui.css"
  | "swagger-ui-bundle.js"
  | "swagger-ui-standalone-preset.js";

export interface SwaggerUiDocumentOptions {
  title: string;
  openApiPath?: string;
  assetBasePath?: string;
}

export interface SwaggerUiControllerOptions extends SwaggerUiDocumentOptions {
  enabled?: () => boolean;
  basicAuth?: BasicAuthOptions;
}

export interface BasicAuthOptions {
  username?: string;
  password?: string;
  realm?: string;
}

/** Same-origin Swagger UI controller with strict CSP and no persisted tokens. */
export class SwaggerUiController extends HttpController {
  constructor(private readonly options: SwaggerUiControllerOptions) {
    super();
  }

  routes() {
    return this.router()
      .get("/docs", this.renderDocs, { docs: { excludeFromOpenApi: true } })
      .get("/docs/assets/swagger-ui.css", this.renderSwaggerCss, {
        docs: { excludeFromOpenApi: true },
      })
      .get("/docs/assets/swagger-ui-bundle.js", this.renderSwaggerBundle, {
        docs: { excludeFromOpenApi: true },
      })
      .get(
        "/docs/assets/swagger-ui-standalone-preset.js",
        this.renderSwaggerPreset,
        { docs: { excludeFromOpenApi: true } },
      )
      .get("/docs/assets/swagger-initializer.js", this.renderInitializer, {
        docs: { excludeFromOpenApi: true },
      })
      .build();
  }

  renderDocs(ctx: HttpContext) {
    if (this.options.enabled && !this.options.enabled()) {
      return response({ message: "OpenAPI is disabled" }, { status: 404 });
    }
    if (
      !isBasicAuthAuthorized(
        ctx.req.headers.authorization,
        this.options.basicAuth,
      )
    ) {
      return response(
        {
          statusCode: 401,
          message: "Authentication required",
          error: "Unauthorized",
        },
        {
          status: 401,
          headers: {
            "www-authenticate": `Basic realm=${JSON.stringify(this.options.basicAuth?.realm ?? "API Docs")}, charset="UTF-8"`,
          },
        },
      );
    }

    return response(createSwaggerUiDocument(this.options), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-security-policy": swaggerUiContentSecurityPolicy(),
        "cache-control": "no-store",
      },
    });
  }

  renderSwaggerCss() {
    return this.renderAsset("swagger-ui.css", "text/css; charset=utf-8");
  }

  renderSwaggerBundle() {
    return this.renderAsset(
      "swagger-ui-bundle.js",
      "text/javascript; charset=utf-8",
    );
  }

  renderSwaggerPreset() {
    return this.renderAsset(
      "swagger-ui-standalone-preset.js",
      "text/javascript; charset=utf-8",
    );
  }

  renderInitializer() {
    return response(createSwaggerUiInitializer(this.options.openApiPath), {
      headers: {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  private async renderAsset(asset: SwaggerUiAssetName, contentType: string) {
    return response(await readSwaggerUiAsset(asset), {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  }
}

/** Protects app-defined documentation routes with Basic credentials. */
export function basicAuth(options: BasicAuthOptions): HttpMiddleware {
  return async (ctx, next) => {
    if (!isBasicAuthAuthorized(ctx.req.headers.authorization, options)) {
      throw new UnauthorizedException("Authentication required", {
        code: "BASIC_AUTH_REQUIRED",
        headers: {
          "www-authenticate": `Basic realm=${JSON.stringify(options.realm ?? "Restricted")}, charset="UTF-8"`,
        },
      });
    }
    return next();
  };
}

export function createSwaggerUiDocument(
  options: SwaggerUiDocumentOptions,
): string {
  const title = escapeHtml(options.title);
  const assetBasePath = normalizeBasePath(
    options.assetBasePath ?? "/docs/assets",
  );

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="${assetBasePath}/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${assetBasePath}/swagger-ui-bundle.js"></script>
    <script src="${assetBasePath}/swagger-ui-standalone-preset.js"></script>
    <script src="${assetBasePath}/swagger-initializer.js"></script>
  </body>
</html>`;
}

export function createSwaggerUiInitializer(
  openApiPath = "/openapi.json",
): string {
  const serializedPath = JSON.stringify(openApiPath);
  return `"use strict";
window.ui = SwaggerUIBundle({
  url: ${serializedPath},
  dom_id: "#swagger-ui",
  deepLinking: true,
  tryItOutEnabled: true,
  persistAuthorization: false,
  presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
  layout: "StandaloneLayout"
});
`;
}

export async function readSwaggerUiAsset(
  asset: SwaggerUiAssetName,
): Promise<Buffer> {
  const filePath = require.resolve(`swagger-ui-dist/${asset}`);
  return fs.readFile(filePath);
}

function normalizeBasePath(value: string): string {
  const prefixed = value.startsWith("/") ? value : `/${value}`;
  return prefixed.endsWith("/") ? prefixed.slice(0, -1) : prefixed;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function swaggerUiContentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
  ].join("; ");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function isBasicAuthAuthorized(
  header: string | undefined,
  auth: BasicAuthOptions | undefined,
): boolean {
  if (!auth?.username && !auth?.password) return true;
  if (!auth.username || !auth.password || !header?.startsWith("Basic ")) {
    return false;
  }

  const decoded = Buffer.from(
    header.slice("Basic ".length).trim(),
    "base64",
  ).toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator < 0) return false;
  return (
    safeEqual(decoded.slice(0, separator), auth.username) &&
    safeEqual(decoded.slice(separator + 1), auth.password)
  );
}
