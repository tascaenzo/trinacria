import { Readable } from "node:stream";
import type { HttpContext } from "../server/http-context";
import { HttpResponse, type HttpResponseHeaders } from "./http-response";

export type HttpResponseBody =
  | string
  | Buffer
  | Uint8Array
  | Readable
  | undefined;

export interface SerializedHttpResponse {
  status?: number;
  headers?: HttpResponseHeaders;
  body?: HttpResponseBody;
}

export type HttpResponseSerializer = (
  value: unknown,
  ctx: HttpContext,
) => SerializedHttpResponse | Promise<SerializedHttpResponse>;

export const defaultResponseSerializer: HttpResponseSerializer = (value) => {
  if (value instanceof HttpResponse) {
    return serializeByBodyType(value.body, value.status, value.headers);
  }

  return serializeByBodyType(value);
};

function serializeByBodyType(
  body: unknown,
  status?: number,
  headers: HttpResponseHeaders = {},
): SerializedHttpResponse {
  if (body === undefined) {
    return { status, headers, body: undefined };
  }

  if (typeof body === "string") {
    return {
      status,
      headers: withDefaultContentType(headers, "text/plain; charset=utf-8"),
      body,
    };
  }

  if (Buffer.isBuffer(body)) {
    return {
      status,
      headers: withDefaultContentType(headers, "application/octet-stream"),
      body,
    };
  }

  if (body instanceof Uint8Array) {
    return {
      status,
      headers: withDefaultContentType(headers, "application/octet-stream"),
      body,
    };
  }

  if (body instanceof Readable) {
    return {
      status,
      headers: withDefaultContentType(headers, "application/octet-stream"),
      body,
    };
  }

  return {
    status,
    headers: withDefaultContentType(headers, "application/json"),
    body: Buffer.from(JSON.stringify(body)),
  };
}

function withDefaultContentType(
  headers: HttpResponseHeaders,
  contentType: string,
): HttpResponseHeaders {
  if (hasHeader(headers, "content-type")) {
    return headers;
  }

  return { ...headers, "content-type": contentType };
}

function hasHeader(headers: HttpResponseHeaders, headerName: string): boolean {
  const target = headerName.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === target);
}
