import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * HTTP request context.
 *
 * Created by the plugin for each incoming request.
 * Passed to middleware and route handlers.
 */
export interface HttpContext {
  /**
   * Raw Node.js request object.
   */
  req: IncomingMessage;

  /**
   * Raw Node.js response object.
   */
  res: ServerResponse;

  /**
   * Route params extracted from path patterns (e.g. `/users/:id`).
   */
  params: Record<string, string>;

  /**
   * Parsed query-string values.
   */
  query: Record<string, string | string[]>;

  /**
   * Parsed request body.
   */
  body: unknown;

  /**
   * Shared mutable state across middleware and handler pipeline.
   */
  state: Record<string, unknown>;
}
