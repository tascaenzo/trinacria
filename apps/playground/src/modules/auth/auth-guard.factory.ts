import { createToken } from "@trinacria/core";
import {
  ForbiddenException,
  HttpMiddleware,
  UnauthorizedException,
  isSafeHttpMethod,
  parseBearerToken,
  readHeaderValue,
} from "@trinacria/http";
import {
  CSRF_TOKEN_HEADER_NAME,
  readAccessTokenFromCookieHeader,
  readCsrfTokenFromCookieHeader,
} from "./auth.cookie";
import { AuthService } from "./auth.service";

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

        if (!cookieToken || !headerValue || cookieToken !== headerValue) {
          throw new ForbiddenException("Invalid CSRF token");
        }
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

  /**
   * CSRF only check, typically used on auth mutation endpoints
   * where session cookie is already expected.
   */
  requireCsrf(): HttpMiddleware {
    return async (ctx, next) => {
      if (isSafeHttpMethod(ctx.req.method)) {
        return next();
      }

      const cookieToken = readCsrfTokenFromCookieHeader(ctx.req.headers.cookie);
      const headerValue = readHeaderValue(
        ctx.req.headers[CSRF_TOKEN_HEADER_NAME],
      );

      if (!cookieToken || !headerValue || cookieToken !== headerValue) {
        throw new ForbiddenException("Invalid CSRF token");
      }

      return next();
    };
  }
}
