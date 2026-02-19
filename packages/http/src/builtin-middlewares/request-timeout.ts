import { HttpException } from "../errors";
import type { HttpMiddleware } from "../middleware/middleware-definition";

export interface RequestTimeoutOptions {
  timeoutMs: number;
  errorMessage?: string;
}

export function requestTimeout(
  options: RequestTimeoutOptions,
): HttpMiddleware {
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new RangeError("requestTimeout.timeoutMs must be > 0");
  }

  const timeoutMs = Math.floor(options.timeoutMs);
  const errorMessage = options.errorMessage ?? "Request timeout";

  return async (ctx, next) => {
    let timeoutId: NodeJS.Timeout | undefined;

    try {
      return await Promise.race([
        next(),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            ctx.abort(new Error("request-timeout"));
            reject(
              new HttpException(errorMessage, 504, {
                code: "REQUEST_TIMEOUT",
              }),
            );
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };
}
