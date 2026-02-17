import { HttpException, type HttpExceptionOptions } from "../errors";
export type { SerializedHttpError } from "../errors";

export interface HttpErrorOptions {
  code?: string;
  details?: unknown;
  headers?: Record<string, string>;
  cause?: unknown;
}

/**
 * @deprecated Usa HttpException / eccezioni predefinite da "../errors".
 */
export class HttpError extends HttpException {
  constructor(status: number, message: string, options: HttpErrorOptions = {}) {
    const exceptionOptions: HttpExceptionOptions = {
      code: options.code,
      details: options.details,
      headers: options.headers,
      cause: options.cause,
    };

    super(message, status, exceptionOptions);
    this.name = "HttpError";
  }
}
