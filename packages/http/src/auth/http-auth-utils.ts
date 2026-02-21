import type { HttpContext } from "../server/http-context";

export function parseBearerToken(
  header: string | string[] | undefined,
): string | undefined {
  if (typeof header !== "string") {
    return undefined;
  }

  const [scheme, token] = header.split(" ");
  if (!token || scheme.toLowerCase() !== "bearer") {
    return undefined;
  }

  return token;
}

export function readHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  if (!value) {
    return undefined;
  }

  return Array.isArray(value) ? value[0] : value;
}

export function readCookieValue(
  cookieHeader: string | string[] | undefined,
  targetName: string,
): string | undefined {
  if (typeof cookieHeader !== "string" || cookieHeader.length === 0) {
    return undefined;
  }

  const cookies = cookieHeader.split(";");
  for (const item of cookies) {
    const [rawName, ...valueParts] = item.trim().split("=");
    if (!rawName || valueParts.length === 0 || rawName !== targetName) {
      continue;
    }

    const rawValue = valueParts.join("=");
    if (!rawValue) {
      return undefined;
    }

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return undefined;
}

export function isSafeHttpMethod(method: string | undefined): boolean {
  const normalized = method?.toUpperCase() ?? "GET";
  return normalized === "GET" || normalized === "HEAD" || normalized === "OPTIONS";
}

export function resolveClientAddress(
  ctx: HttpContext,
  trustProxy = false,
): string {
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
