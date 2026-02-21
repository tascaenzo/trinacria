import {
  ForbiddenException,
  HttpMiddleware,
  UnauthorizedException,
} from "@trinacria/http";
import {
  CSRF_TOKEN_HEADER_NAME,
  readAccessTokenFromCookieHeader,
  readCsrfTokenFromCookieHeader,
} from "./auth.cookie";
import { AuthService } from "./auth.service";

export class AuthGuardFactory {
  constructor(private readonly authService: AuthService) {}

  requireAuth(): HttpMiddleware {
    return async (ctx, next) => {
      const token =
        readAccessTokenFromCookieHeader(ctx.req.headers.cookie) ??
        extractBearerToken(ctx.req.headers.authorization);

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

  requireCsrf(): HttpMiddleware {
    return async (ctx, next) => {
      const method = ctx.req.method?.toUpperCase() ?? "GET";
      if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
        return next();
      }

      const cookieToken = readCsrfTokenFromCookieHeader(ctx.req.headers.cookie);
      const headerValue = extractHeaderValue(
        ctx.req.headers[CSRF_TOKEN_HEADER_NAME],
      );

      if (!cookieToken || !headerValue || cookieToken !== headerValue) {
        throw new ForbiddenException("Invalid CSRF token");
      }

      return next();
    };
  }
}

function extractBearerToken(
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

function extractHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  if (!value) {
    return undefined;
  }

  return Array.isArray(value) ? value[0] : value;
}
