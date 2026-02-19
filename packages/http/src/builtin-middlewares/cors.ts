import type { HttpMiddleware } from "../middleware/middleware-definition";

type OriginValue = "*" | string | RegExp | Array<string | RegExp>;

export interface CorsOptions {
  origin?: OriginValue;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
  optionsSuccessStatus?: number;
}

const DEFAULT_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

export function cors(options: CorsOptions = {}): HttpMiddleware {
  const methods = options.methods ?? DEFAULT_METHODS;
  const allowedHeaders = options.allowedHeaders;
  const exposedHeaders = options.exposedHeaders;
  const credentials = options.credentials ?? false;
  const maxAge = options.maxAge;
  const optionsSuccessStatus = options.optionsSuccessStatus ?? 204;

  return async (ctx, next) => {
    const requestOriginHeader = ctx.req.headers.origin;
    const requestOrigin = Array.isArray(requestOriginHeader)
      ? requestOriginHeader[0]
      : requestOriginHeader;
    const requestMethodHeader = ctx.req.headers["access-control-request-method"];
    const requestedMethod = Array.isArray(requestMethodHeader)
      ? requestMethodHeader[0]
      : requestMethodHeader;

    const allowedOrigin = resolveAllowedOrigin(
      options.origin,
      requestOrigin,
      credentials,
    );
    if (allowedOrigin) {
      ctx.res.setHeader("access-control-allow-origin", allowedOrigin);
      appendVary(ctx.res, "Origin");
    }

    if (credentials) {
      ctx.res.setHeader("access-control-allow-credentials", "true");
    }

    if (exposedHeaders && exposedHeaders.length > 0) {
      ctx.res.setHeader("access-control-expose-headers", exposedHeaders.join(", "));
    }

    if (
      ctx.req.method?.toUpperCase() === "OPTIONS" &&
      Boolean(requestOrigin) &&
      Boolean(requestedMethod)
    ) {
      ctx.res.setHeader("access-control-allow-methods", methods.join(", "));

      if (allowedHeaders && allowedHeaders.length > 0) {
        ctx.res.setHeader("access-control-allow-headers", allowedHeaders.join(", "));
      } else {
        const reqHeaders = ctx.req.headers["access-control-request-headers"];
        if (reqHeaders) {
          ctx.res.setHeader(
            "access-control-allow-headers",
            Array.isArray(reqHeaders) ? reqHeaders.join(", ") : reqHeaders,
          );
        }
      }

      if (typeof maxAge === "number" && Number.isFinite(maxAge) && maxAge > 0) {
        ctx.res.setHeader("access-control-max-age", String(Math.floor(maxAge)));
      }

      ctx.res.statusCode = optionsSuccessStatus;
      ctx.res.end();
      return;
    }

    return next();
  };
}

function resolveAllowedOrigin(
  origin: OriginValue | undefined,
  requestOrigin: string | undefined,
  credentials: boolean,
): string | null {
  if (origin === undefined || origin === "*") {
    if (credentials) {
      return requestOrigin ?? null;
    }

    return "*";
  }

  if (!requestOrigin) {
    return null;
  }

  if (typeof origin === "string") {
    return origin === requestOrigin ? requestOrigin : null;
  }

  if (origin instanceof RegExp) {
    return origin.test(requestOrigin) ? requestOrigin : null;
  }

  for (const candidate of origin) {
    if (typeof candidate === "string" && candidate === requestOrigin) {
      return requestOrigin;
    }
    if (candidate instanceof RegExp && candidate.test(requestOrigin)) {
      return requestOrigin;
    }
  }

  return null;
}

function appendVary(
  res: { getHeader(name: string): number | string | string[] | undefined; setHeader(name: string, value: string): void },
  token: string,
): void {
  const current = res.getHeader("vary");
  if (!current) {
    res.setHeader("vary", token);
    return;
  }

  const serialized = Array.isArray(current) ? current.join(",") : String(current);
  const values = serialized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!values.some((value) => value.toLowerCase() === token.toLowerCase())) {
    values.push(token);
  }

  res.setHeader("vary", values.join(", "));
}
