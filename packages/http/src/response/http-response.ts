export type HttpResponseHeaders = Record<string, string>;

/**
 * Explicit HTTP response envelope returned by handlers when status/headers must be controlled.
 */
export class HttpResponse<T = unknown> {
  readonly status?: number;
  readonly headers?: HttpResponseHeaders;
  readonly body: T;

  constructor(
    body: T,
    options: { status?: number; headers?: HttpResponseHeaders } = {},
  ) {
    this.body = body;
    this.status = options.status;
    this.headers = options.headers;
  }
}

export function response<T>(
  body: T,
  options: { status?: number; headers?: HttpResponseHeaders } = {},
): HttpResponse<T> {
  return new HttpResponse(body, options);
}
