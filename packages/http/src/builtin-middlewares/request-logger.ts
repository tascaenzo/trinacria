import { ConsoleLogger } from "@trinacria/core";
import type { HttpMiddleware } from "../middleware/middleware-definition";

export interface RequestLoggerOptions {
  context?: string;
  includeUserAgent?: boolean;
}

export function requestLogger(
  options: RequestLoggerOptions = {},
): HttpMiddleware {
  const logger = new ConsoleLogger(options.context ?? "http:request");
  const includeUserAgent = options.includeUserAgent ?? false;

  return async (ctx, next) => {
    const startedAt = Date.now();

    try {
      const result = await next();
      logLine(logger, ctx.req.method, ctx.req.url, ctx.res.statusCode, startedAt, includeUserAgent, ctx.req.headers["user-agent"]);
      return result;
    } catch (error) {
      logLine(logger, ctx.req.method, ctx.req.url, ctx.res.statusCode || 500, startedAt, includeUserAgent, ctx.req.headers["user-agent"]);
      throw error;
    }
  };
}

function logLine(
  logger: ConsoleLogger,
  method: string | undefined,
  url: string | undefined,
  statusCode: number,
  startedAt: number,
  includeUserAgent: boolean,
  userAgentHeader: string | string[] | undefined,
): void {
  const durationMs = Date.now() - startedAt;
  const methodValue = method ?? "UNKNOWN";
  const urlValue = url ?? "<unknown>";
  let line = `${methodValue} ${urlValue} -> ${statusCode} (${durationMs}ms)`;

  if (includeUserAgent) {
    const userAgent = Array.isArray(userAgentHeader)
      ? userAgentHeader[0]
      : userAgentHeader;
    line += ` ua=${userAgent ?? "-"}`;
  }

  logger.info(line);
}
