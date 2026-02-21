import { HttpMiddleware } from "../middleware/middleware-definition";
import type { HttpContext } from "../server/http-context";

/**
 * HTTP methods currently supported by the router.
 */
export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

/**
 * Route handler function.
 *
 * It can:
 * - return a value (serialized into an HTTP response)
 * - return `undefined` and write directly to `ctx.res`
 */
export type RouteHandler = (ctx: HttpContext) => unknown | Promise<unknown>;

export interface RouteOpenApiRequestBody {
  required?: boolean;
  description?: string;
  contentType?: string;
  schema?: Record<string, unknown>;
}

export interface RouteOpenApiResponse {
  description: string;
  contentType?: string;
  schema?: Record<string, unknown>;
}

export interface RouteOpenApiDocs {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  deprecated?: boolean;
  security?: Array<Record<string, string[]>>;
  requestBody?: RouteOpenApiRequestBody;
  responses?: Record<number, RouteOpenApiResponse>;
}

export interface RouteOptions {
  middlewares?: HttpMiddleware[];
  docs?: RouteOpenApiDocs;
}

/**
 * Declarative route definition.
 */
export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handler: RouteHandler;
  middlewares?: HttpMiddleware[];
  handlerName?: string;
  docs?: RouteOpenApiDocs;
}
