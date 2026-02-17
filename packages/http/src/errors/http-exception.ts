import { STATUS_CODES } from "node:http";

export type HttpExceptionResponse = string | Record<string, unknown>;

export interface HttpExceptionOptions {
  code?: string;
  details?: unknown;
  headers?: Record<string, string>;
  cause?: unknown;
}

/**
 * Base HTTP exception carrying status, response payload, optional code/details, and headers.
 */
export class HttpException extends Error {
  readonly code?: string;
  readonly details?: unknown;
  readonly headers?: Record<string, string>;

  constructor(
    private readonly response: HttpExceptionResponse,
    private readonly status: number,
    options: HttpExceptionOptions = {},
  ) {
    super(resolveMessage(response, status), {
      cause: options.cause,
    });

    this.name = "HttpException";
    this.code = options.code;
    this.details = options.details;
    this.headers = options.headers;
  }

  getStatus(): number {
    return this.status;
  }

  getResponse(): HttpExceptionResponse {
    return this.response;
  }
}

function resolveMessage(
  response: HttpExceptionResponse,
  status: number,
): string {
  if (typeof response === "string") {
    return response;
  }

  if (typeof response.message === "string") {
    return response.message;
  }

  return STATUS_CODES[status] ?? "Http Exception";
}
