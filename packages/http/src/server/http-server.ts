import http from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ConsoleLogger } from "@trinacria/core";
import type { Router } from "../routing/router";
import type { HttpMethod } from "../routing/route-definition";
import type { HttpContext } from "./http-context";
import type { HttpMiddleware } from "../middleware/middleware-definition";
import { HttpExecutor } from "./http-executor";
import {
  BadRequestException,
  type HttpExceptionHandler,
  MethodNotAllowedException,
  NotFoundException,
  PayloadTooLargeException,
  defaultExceptionHandler,
  type SerializedHttpError,
} from "../errors";
import {
  defaultResponseSerializer,
  type HttpResponseSerializer,
  type SerializedHttpResponse,
} from "../response";

const DEFAULT_JSON_BODY_LIMIT_BYTES = 1_048_576;

export type HttpServerErrorSerializer = (
  error: unknown,
  ctx: HttpContext,
) => SerializedHttpError;
export type { HttpExceptionHandler };

interface HttpServerOptions {
  globalMiddlewares?: HttpMiddleware[];
  jsonBodyLimitBytes?: number;
  exceptionHandler?: HttpExceptionHandler;
  responseSerializer?: HttpResponseSerializer;
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
    this.exceptionHandler =
      options.exceptionHandler ??
      options.errorSerializer ??
      defaultExceptionHandler;
    this.responseSerializer =
      options.responseSerializer ?? defaultResponseSerializer;

    this.server = http.createServer(this.handleRequest.bind(this));
  }

  listen(port: number, host: string = "0.0.0.0"): void {
    this.server.listen(port, host);
    this.logger.info(`[HttpServer] Listening on http://${host}:${port}`);
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
      this.writeErrorResponse(
        defaultExceptionHandler(new BadRequestException(), {
          req,
          res,
          params: {},
          query: {},
          body: undefined,
          state: {},
        }),
        req,
        res,
      );
      return;
    }

    const method = req.method.toUpperCase() as HttpMethod;
    const match = this.router.match(method, req.url);

    if (!match) {
      const allowedMethods = this.router.allowedMethods(req.url);

      if (allowedMethods.length > 0) {
        this.writeErrorResponse(
          this.exceptionHandler(new MethodNotAllowedException(allowedMethods), {
            req,
            res,
            params: {},
            query: {},
            body: undefined,
            state: {},
          }),
          req,
          res,
        );
        return;
      }

      this.writeErrorResponse(
        this.exceptionHandler(new NotFoundException(), {
          req,
          res,
          params: {},
          query: {},
          body: undefined,
          state: {},
        }),
        req,
        res,
      );
      return;
    }

    const ctx: HttpContext = {
      req,
      res,
      params: match.params,
      query: match.query,
      body: undefined,
      state: {},
    };

    try {
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

    const rawBody = await this.readRawBody(req);
    if (rawBody.length === 0) {
      return undefined;
    }

    const contentType = this.getHeader(req.headers["content-type"]) ?? "";

    if (contentType.toLowerCase().includes("application/json")) {
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
