import http from "node:http";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ConsoleLogger } from "@trinacria/core";
import {
  BadRequestException,
  defaultExceptionHandler,
  type HttpExceptionHandler,
  MethodNotAllowedException,
  NotFoundException,
  PayloadTooLargeException,
  type SerializedHttpError,
} from "../errors";
import type { HttpMiddleware } from "../middleware/middleware-definition";
import {
  defaultResponseSerializer,
  type HttpResponseSerializer,
  type SerializedHttpResponse,
} from "../response";
import type { HttpMethod } from "../routing/route-definition";
import type { Router } from "../routing/router";
import type { HttpContext } from "./http-context";
import { HttpExecutor } from "./http-executor";

const DEFAULT_JSON_BODY_LIMIT_BYTES = 1_048_576;
const DEFAULT_STREAMING_BODY_CONTENT_TYPES = [
  "multipart/form-data",
  "application/octet-stream",
];

export type HttpServerErrorSerializer = (
  error: unknown,
  ctx: HttpContext,
) => SerializedHttpError;
export type { HttpExceptionHandler };

export interface HttpServerOptions {
  globalMiddlewares?: HttpMiddleware[];
  jsonBodyLimitBytes?: number;
  streamingBodyContentTypes?: string[];
  exceptionHandler?: HttpExceptionHandler;
  responseSerializer?: HttpResponseSerializer;
  requestTimeoutMs?: number;
  headersTimeoutMs?: number;
  keepAliveTimeoutMs?: number;
  maxRequestsPerSocket?: number;
  /**
   * @deprecated Use `exceptionHandler`.
   */
  errorSerializer?: HttpServerErrorSerializer;
}

/**
 * Thin HTTP server runtime built on Node's `http` module.
 * It handles matching, middleware execution, body parsing, and response/error serialization.
 */
export class HttpServer {
  private server: http.Server;
  private logger = new ConsoleLogger("plugin:http");
  private executor: HttpExecutor;
  private jsonBodyLimitBytes: number;
  private streamingBodyContentTypes: string[];
  private exceptionHandler: HttpExceptionHandler;
  private responseSerializer: HttpResponseSerializer;
  private closePromise: Promise<void> | null = null;

  constructor(
    private readonly router: Router,
    options: HttpServerOptions = {},
  ) {
    this.executor = new HttpExecutor(options.globalMiddlewares ?? []);
    this.jsonBodyLimitBytes =
      options.jsonBodyLimitBytes ?? DEFAULT_JSON_BODY_LIMIT_BYTES;
    this.streamingBodyContentTypes =
      options.streamingBodyContentTypes ?? DEFAULT_STREAMING_BODY_CONTENT_TYPES;
    this.exceptionHandler =
      options.exceptionHandler ??
      options.errorSerializer ??
      defaultExceptionHandler;
    this.responseSerializer =
      options.responseSerializer ?? defaultResponseSerializer;

    this.server = http.createServer(this.handleRequest.bind(this));
    this.server.requestTimeout = normalizeTimeout(
      options.requestTimeoutMs,
      30_000,
      "requestTimeoutMs",
    );
    this.server.headersTimeout = normalizeTimeout(
      options.headersTimeoutMs,
      15_000,
      "headersTimeoutMs",
    );
    this.server.keepAliveTimeout = normalizeTimeout(
      options.keepAliveTimeoutMs,
      5_000,
      "keepAliveTimeoutMs",
    );
    this.server.maxRequestsPerSocket = normalizePositiveInteger(
      options.maxRequestsPerSocket,
      1_000,
      "maxRequestsPerSocket",
    );
  }

  listen(port: number, host: string = "0.0.0.0"): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        this.server.off("listening", onListening);
        reject(error);
      };

      const onListening = () => {
        this.server.off("error", onError);
        this.logger.info(`[HttpServer] Listening on http://${host}:${port}`);
        resolve();
      };

      this.server.once("error", onError);
      this.server.once("listening", onListening);
      this.server.listen(port, host);
    });
  }

  async close(): Promise<void> {
    if (this.closePromise) {
      return this.closePromise;
    }

    this.closePromise = new Promise<void>((resolve, reject) => {
      this.server.close((err) => {
        if (err) {
          reject(err);
          return;
        }

        resolve();
      });

      // Close idle keep-alive sockets immediately.
      this.server.closeIdleConnections?.();

      // Hard-stop fallback if some connections are still open.
      setTimeout(() => {
        this.server.closeAllConnections?.();
      }, 1000).unref();
    });

    try {
      await this.closePromise;
    } finally {
      this.closePromise = null;
    }
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    if (!req.url || !req.method) {
      const controller = new AbortController();
      const baseCtx: HttpContext = {
        req,
        res,
        params: {},
        query: {},
        body: undefined,
        signal: controller.signal,
        abort: (reason?: unknown) => controller.abort(reason),
        state: {},
      };

      this.writeErrorResponse(
        defaultExceptionHandler(new BadRequestException(), baseCtx),
        req,
        res,
      );
      return;
    }

    const abortController = new AbortController();
    req.once("aborted", () => abortController.abort("request-aborted"));
    req.once("close", () => {
      if (!res.writableEnded) {
        abortController.abort("request-closed");
      }
    });

    let ctx: HttpContext = {
      req,
      res,
      params: {},
      query: {},
      body: undefined,
      signal: abortController.signal,
      abort: (reason?: unknown) => abortController.abort(reason),
      state: {},
    };

    try {
      const method = req.method.toUpperCase() as HttpMethod;
      const match = this.router.match(method, req.url);

      if (!match) {
        const allowedMethods = this.router.allowedMethods(req.url);

        if (allowedMethods.length > 0) {
          this.writeErrorResponse(
            this.exceptionHandler(
              new MethodNotAllowedException(allowedMethods),
              ctx,
            ),
            req,
            res,
          );
          return;
        }

        this.writeErrorResponse(
          this.exceptionHandler(new NotFoundException(), ctx),
          req,
          res,
        );
        return;
      }

      ctx = {
        ...ctx,
        params: match.params,
        query: match.query,
      };

      ctx.body = await this.parseRequestBody(req);
      const result = await this.executor.execute(match.route, ctx);

      if (res.writableEnded) return;

      if (result !== undefined) {
        const serialized = await this.responseSerializer(result, ctx);
        await this.writeSerializedResponse(serialized, req, res);
        return;
      }

      res.end();
    } catch (err) {
      this.logger.error("Unhandled error in request", err);
      this.writeErrorResponse(this.exceptionHandler(err, ctx), req, res);
    }
  }

  private async parseRequestBody(req: http.IncomingMessage): Promise<unknown> {
    if (!this.hasRequestBody(req)) {
      return undefined;
    }

    const contentType = this.getHeader(req.headers["content-type"]) ?? "";
    const normalizedContentType = contentType.toLowerCase();

    if (this.isStreamingContentType(normalizedContentType)) {
      this.assertDeclaredBodySizeWithinLimit(req, this.jsonBodyLimitBytes);
      return this.createLimitedBodyStream(req, this.jsonBodyLimitBytes);
    }

    const rawBody = await this.readRawBody(req);
    if (rawBody.length === 0) {
      return undefined;
    }

    if (normalizedContentType.includes("application/json")) {
      try {
        return JSON.parse(rawBody.toString("utf8"));
      } catch {
        throw new BadRequestException("Invalid JSON body", {
          code: "INVALID_JSON_BODY",
        });
      }
    }

    return rawBody;
  }

  private isStreamingContentType(contentType: string): boolean {
    return this.streamingBodyContentTypes.some((candidate) =>
      contentType.includes(candidate.toLowerCase()),
    );
  }

  private hasRequestBody(req: http.IncomingMessage): boolean {
    if (req.headers["transfer-encoding"]) {
      return true;
    }

    const contentLengthValue = this.getHeader(req.headers["content-length"]);
    if (!contentLengthValue) {
      return false;
    }

    const contentLength = Number.parseInt(contentLengthValue, 10);
    return Number.isFinite(contentLength) && contentLength > 0;
  }

  private async readRawBody(req: http.IncomingMessage): Promise<Buffer> {
    this.assertDeclaredBodySizeWithinLimit(req, this.jsonBodyLimitBytes);
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let total = 0;

      req.on("data", (chunk: Buffer) => {
        total += chunk.length;

        if (total > this.jsonBodyLimitBytes) {
          reject(
            new PayloadTooLargeException("Payload too large", {
              code: "PAYLOAD_TOO_LARGE",
            }),
          );
          req.destroy();
          return;
        }

        chunks.push(chunk);
      });

      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("aborted", () =>
        reject(
          new BadRequestException("Request was aborted", { code: "ABORTED" }),
        ),
      );
      req.on("error", (error) => reject(error));
    });
  }

  private assertDeclaredBodySizeWithinLimit(
    req: http.IncomingMessage,
    limitBytes: number,
  ): void {
    const value = this.getHeader(req.headers["content-length"]);
    if (!value) return;

    const declared = Number(value);
    if (Number.isFinite(declared) && declared > limitBytes) {
      throw new PayloadTooLargeException("Payload too large", {
        code: "PAYLOAD_TOO_LARGE",
      });
    }
  }

  private createLimitedBodyStream(
    req: http.IncomingMessage,
    limitBytes: number,
  ): Readable {
    let total = 0;
    const limiter = new Transform({
      transform(chunk: Buffer | string, _encoding, callback) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buffer.length;
        if (total > limitBytes) {
          callback(
            new PayloadTooLargeException("Payload too large", {
              code: "PAYLOAD_TOO_LARGE",
            }),
          );
          return;
        }
        callback(null, buffer);
      },
    });

    // Always handle the limiter error even if a route ignores the stream.
    limiter.on("error", () => req.destroy());
    req.pipe(limiter);
    return limiter;
  }

  private writeErrorResponse(
    normalized: SerializedHttpError,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    if (res.writableEnded) {
      return;
    }

    if (normalized.headers && !res.headersSent) {
      for (const [name, value] of Object.entries(normalized.headers)) {
        res.setHeader(name, value);
      }
    }

    res.statusCode = normalized.status;

    if (req.method?.toUpperCase() === "HEAD") {
      res.end();
      return;
    }

    if (!res.headersSent) {
      res.setHeader("content-type", "application/json");
    }

    res.end(JSON.stringify(normalized.body));
  }

  private async writeSerializedResponse(
    serialized: SerializedHttpResponse,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    if (res.writableEnded) {
      return;
    }

    if (serialized.headers && !res.headersSent) {
      for (const [name, value] of Object.entries(serialized.headers)) {
        res.setHeader(name, value);
      }
    }

    res.statusCode = serialized.status ?? res.statusCode ?? 200;

    if (req.method?.toUpperCase() === "HEAD") {
      res.end();
      return;
    }

    if (serialized.body === undefined) {
      res.end();
      return;
    }

    if (serialized.body instanceof Readable) {
      await pipeline(serialized.body, res);
      return;
    }

    res.end(serialized.body);
  }

  private getHeader(value: string | string[] | undefined): string | undefined {
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : value;
  }
}

function normalizeTimeout(
  value: number | undefined,
  fallback: number,
  name: string,
): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value < 1) {
    throw new RangeError(`HttpServer.${name} must be >= 1`);
  }
  return Math.floor(value);
}

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
  name: string,
): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`HttpServer.${name} must be an integer >= 1`);
  }
  return value;
}
