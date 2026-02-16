import http from "node:http";
import { ConsoleLogger } from "@trinacria/core";
import type { Router } from "../routing/router";
import type { HttpMethod } from "../routing/route-definition";
import type { HttpContext } from "./http-context";
import type { HttpMiddleware } from "../middleware/middleware-definition";
import { HttpExecutor } from "./http-executor";

interface HttpServerOptions {
  globalMiddlewares?: HttpMiddleware[];
}

export class HttpServer {
  private server: http.Server;
  private logger = new ConsoleLogger("plugin:http");
  private executor: HttpExecutor;

  constructor(
    private readonly router: Router,
    options: HttpServerOptions = {},
  ) {
    this.executor = new HttpExecutor(options.globalMiddlewares ?? []);

    this.server = http.createServer(this.handleRequest.bind(this));
  }

  listen(port: number, host: string = "0.0.0.0"): void {
    this.server.listen(port, host);
    this.logger.info(`[HttpServer] Listening on http://${host}:${port}`);
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.server.close(() => resolve());
    });
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    if (!req.url || !req.method) {
      res.statusCode = 400;
      res.end("Bad Request");
      return;
    }

    const match = this.router.match(req.method as HttpMethod, req.url);

    if (!match) {
      res.statusCode = 404;
      res.end("Not Found");
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
      const result = await this.executor.execute(match.route, ctx);

      if (res.writableEnded) return;

      if (result !== undefined) {
        if (!res.headersSent) {
          res.setHeader("content-type", "application/json");
        }

        res.statusCode = res.statusCode || 200;
        res.end(JSON.stringify(result));
        return;
      }

      res.end();
    } catch (err) {
      this.logger.error("Unhandled error in request", err);

      if (!res.writableEnded) {
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    }
  }
}
