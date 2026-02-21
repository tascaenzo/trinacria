import {
  HttpMiddleware,
  rateLimit,
  resolveClientAddress,
} from "@trinacria/http";
import { AuthConfig } from "./auth.config";

/**
 * Brute-force protection for login.
 * Key is IP + normalized email so a single actor cannot hammer one account.
 */
export function createLoginRateLimitMiddleware(
  config: AuthConfig,
): HttpMiddleware {
  return rateLimit({
    trustProxy: config.trustProxy,
    windowMs: 60_000,
    max: 10,
    keyGenerator: (ctx) => {
      const email = readLoginEmail(ctx.body);
      const ip = resolveClientAddress(ctx, config.trustProxy);
      return `auth:login:${ip}:${email}`;
    },
  });
}

/**
 * Abuse protection for auth state mutations (refresh/logout).
 * Key is IP because these operations are already tied to session cookies/tokens.
 */
export function createAuthMutationRateLimitMiddleware(
  config: AuthConfig,
): HttpMiddleware {
  return rateLimit({
    trustProxy: config.trustProxy,
    windowMs: 60_000,
    max: 30,
    keyGenerator: (ctx) => {
      const ip = resolveClientAddress(ctx, config.trustProxy);
      return `auth:mutation:${ip}`;
    },
  });
}

/**
 * Extract email from request body only for rate-limit partitioning.
 * Falls back to "unknown" when payload is missing/invalid.
 */
function readLoginEmail(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "unknown";
  }

  const email = (body as { email?: unknown }).email;
  return typeof email === "string" ? email.trim().toLowerCase() : "unknown";
}
