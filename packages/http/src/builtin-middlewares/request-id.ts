import { randomUUID } from "node:crypto";
import type { HttpMiddleware } from "../middleware/middleware-definition";

export interface RequestIdOptions {
  headerName?: string;
  stateKey?: string;
  generator?: () => string;
}

const DEFAULT_HEADER_NAME = "x-request-id";
const DEFAULT_STATE_KEY = "requestId";

export function requestId(options: RequestIdOptions = {}): HttpMiddleware {
  const headerName = options.headerName ?? DEFAULT_HEADER_NAME;
  const stateKey = options.stateKey ?? DEFAULT_STATE_KEY;
  const generator = options.generator ?? randomUUID;

  return async (ctx, next) => {
    const existing = ctx.req.headers[headerName];
    const requestIdValue = Array.isArray(existing)
      ? existing[0]
      : existing ?? generator();

    if (!ctx.res.hasHeader(headerName)) {
      ctx.res.setHeader(headerName, requestIdValue);
    }

    ctx.state[stateKey] = requestIdValue;
    return next();
  };
}
