import { HttpMiddleware } from "../middleware/middleware-definition";
import type { HttpContext } from "../server/http-context";

/**
 * Metodi HTTP supportati nel primo step.
 */
export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD";

/**
 * Handler di una route.
 *
 * Può:
 * - Restituire un valore (verrà serializzato come JSON)
 * - Non restituire nulla e scrivere direttamente su res
 */
export type RouteHandler = (ctx: HttpContext) => unknown | Promise<unknown>;

/**
 * Definizione dichiarativa di una route.
 */
export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handler: RouteHandler;
  middlewares?: HttpMiddleware[];
}
