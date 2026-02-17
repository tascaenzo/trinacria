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

/**
 * Declarative route definition.
 */
export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handler: RouteHandler;
  middlewares?: HttpMiddleware[];
}
