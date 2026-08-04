import { createToken } from "@trinacria/core";
import {
  ForbiddenException,
  type HttpMiddleware,
  isSafeHttpMethod,
  parseBearerToken,
  readHeaderValue,
  UnauthorizedException,
} from "@trinacria/http";
import {
  CSRF_TOKEN_HEADER_NAME,
  readAccessTokenFromCookieHeader,
  readCsrfTokenFromCookieHeader,
  readRefreshTokenFromCookieHeader,
} from "./auth.cookie";
import type { AuthService } from "./auth.service";
import type { JwtClaims } from "./jwt";

export const AUTH_GUARD_FACTORY =
  createToken<AuthGuardFactory>("AUTH_GUARD_FACTORY");

export class AuthGuardFactory {
  constructor(private readonly authService: AuthService) {}

  /**
   * Unified protection middleware for authenticated routes:
   * 1) authenticate via access-token cookie or bearer header
   * 2) enforce CSRF on non-safe HTTP methods
   */
  requireProtectedRoute(): HttpMiddleware {
    return async (ctx, next) => {
      const token =
        readAccessTokenFromCookieHeader(ctx.req.headers.cookie) ??
        parseBearerToken(ctx.req.headers.authorization);

      if (!token) {
        throw new UnauthorizedException(
          "Missing token in HttpOnly cookie or Authorization header",
        );
      }

      const claims = await this.authService.verifyAccessToken(token);
      ctx.state.auth = claims;

      if (!isSafeHttpMethod(ctx.req.method)) {
        const cookieToken = readCsrfTokenFromCookieHeader(
          ctx.req.headers.cookie,
        );
        const headerValue = readHeaderValue(
          ctx.req.headers[CSRF_TOKEN_HEADER_NAME],
        );

        await this.authService.verifySessionCsrf(
          claims.sid,
          cookieToken,
          headerValue,
        );
      }

      return next();
    };
  }

  /**
   * Authentication only (no CSRF check).
   * Kept for cases where CSRF is not relevant (for example read-only APIs).
   */
  requireAuth(): HttpMiddleware {
    return async (ctx, next) => {
      const token =
        readAccessTokenFromCookieHeader(ctx.req.headers.cookie) ??
        parseBearerToken(ctx.req.headers.authorization);

      if (!token) {
        throw new UnauthorizedException(
          "Missing token in HttpOnly cookie or Authorization header",
        );
      }

      const claims = await this.authService.verifyAccessToken(token);
      ctx.state.auth = claims;

      return next();
    };
  }

  requireRoles(...roles: string[]): HttpMiddleware {
    const allowed = new Set(roles);
    return async (ctx, next) => {
      const claims = ctx.state.auth as JwtClaims | undefined;
      if (!claims) {
        throw new UnauthorizedException("Authentication state is missing");
      }
      if (!allowed.has(claims.role)) {
        throw new ForbiddenException("Insufficient permissions");
      }
      return next();
    };
  }

  /**
   * CSRF only check, typically used on auth mutation endpoints
   * where session cookie is already expected.
   */
  requireRefreshCsrf(): HttpMiddleware {
    return async (ctx, next) => {
      if (isSafeHttpMethod(ctx.req.method)) {
        return next();
      }

      const cookieToken = readCsrfTokenFromCookieHeader(ctx.req.headers.cookie);
      const headerValue = readHeaderValue(
        ctx.req.headers[CSRF_TOKEN_HEADER_NAME],
      );

      const refreshToken = readRefreshTokenFromCookieHeader(
        ctx.req.headers.cookie,
      );
      await this.authService.verifyRefreshRequest(
        refreshToken,
        cookieToken,
        headerValue,
      );

      return next();
    };
  }
}
