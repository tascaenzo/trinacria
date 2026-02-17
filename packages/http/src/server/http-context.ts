import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Contesto di una richiesta HTTP.
 *
 * Creato dal plugin per ogni request.
 * Passato a middleware e handler.
 */
export interface HttpContext {
  /**
   * Request raw di Node.
   */
  req: IncomingMessage;

  /**
   * Response raw di Node.
   */
  res: ServerResponse;

  /**
   * Parametri estratti dal path (es: /users/:id).
   */
  params: Record<string, string>;

  /**
   * Query string parsata.
   */
  query: Record<string, string | string[]>;

  /**
   * Body parsato (JSON nel primo step).
   */
  body: unknown;

  /**
   * Stato condiviso tra middleware e handler.
   */
  state: Record<string, unknown>;
}
