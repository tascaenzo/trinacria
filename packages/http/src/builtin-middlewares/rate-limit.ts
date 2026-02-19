import { TooManyRequestsException } from "../errors";
import type { HttpMiddleware } from "../middleware/middleware-definition";
import type { HttpContext } from "../server/http-context";

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  trustProxy?: boolean;
  keyGenerator?: (ctx: HttpContext) => string;
  store?: RateLimitStore;
}

interface Counter {
  count: number;
  resetAt: number;
}

export interface RateLimitStore {
  increment(key: string, now: number, windowMs: number): Counter;
  prune?(now: number): void;
}

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX = 120;

export function rateLimit(options: RateLimitOptions = {}): HttpMiddleware {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const max = options.max ?? DEFAULT_MAX;
  const trustProxy = options.trustProxy ?? false;
  const store = options.store ?? createMemoryRateLimitStore();
  const keyGenerator =
    options.keyGenerator ??
    ((ctx: HttpContext) => getClientAddress(ctx, trustProxy));

  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new RangeError("rateLimit.windowMs must be > 0");
  }

  if (!Number.isFinite(max) || max <= 0) {
    throw new RangeError("rateLimit.max must be > 0");
  }

  const roundedWindow = Math.floor(windowMs);
  const roundedMax = Math.floor(max);

  return async (ctx, next) => {
    const now = Date.now();
    const key = keyGenerator(ctx);
    const counter = store.increment(key, now, roundedWindow);
    const remaining = Math.max(0, roundedMax - counter.count);

    ctx.res.setHeader("x-ratelimit-limit", String(roundedMax));
    ctx.res.setHeader("x-ratelimit-remaining", String(remaining));
    ctx.res.setHeader(
      "x-ratelimit-reset",
      String(Math.ceil(counter.resetAt / 1000)),
    );

    store.prune?.(now);

    if (counter.count > roundedMax) {
      const retryAfter = Math.max(
        1,
        Math.ceil((counter.resetAt - now) / 1000),
      );

      throw new TooManyRequestsException("Too Many Requests", {
        code: "RATE_LIMITED",
        headers: {
          "retry-after": String(retryAfter),
        },
      });
    }

    return next();
  };
}

function getClientAddress(ctx: HttpContext, trustProxy: boolean): string {
  if (trustProxy) {
    const forwardedFor = ctx.req.headers["x-forwarded-for"];
    const fromHeader = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor;
    const client = fromHeader?.split(",")[0]?.trim();
    if (client) {
      return client;
    }
  }

  return ctx.req.socket.remoteAddress || "unknown";
}

function createMemoryRateLimitStore(): RateLimitStore {
  const map = new Map<string, Counter>();

  return {
    increment(key: string, now: number, windowMs: number): Counter {
      const current = map.get(key);

      if (!current || current.resetAt <= now) {
        const nextCounter = { count: 1, resetAt: now + windowMs };
        map.set(key, nextCounter);
        return nextCounter;
      }

      current.count += 1;
      return current;
    },
    prune(now: number): void {
      if (map.size <= 10_000) {
        return;
      }

      for (const [storedKey, value] of map.entries()) {
        if (value.resetAt <= now) {
          map.delete(storedKey);
        }
      }
    },
  };
}
