import { createToken } from "@trinacria/core";
import {
  HttpController,
  HttpContext,
  UnauthorizedException,
  response,
} from "@trinacria/http";
import { AuthConfig } from "./auth.config";
import { AuthGuardFactory } from "./auth-guard.factory";
import {
  createCookieSecurityOptions,
  readRefreshTokenFromCookieHeader,
  serializeAccessTokenCookie,
  serializeAuthCookieClears,
  serializeCsrfTokenCookie,
  serializeRefreshTokenCookie,
} from "./auth.cookie";
import {
  createAuthMutationRateLimitMiddleware,
  createLoginRateLimitMiddleware,
} from "./auth.middleware";
import { AuthService } from "./auth.service";
import { JwtClaims } from "./jwt";
import { AuthResultDtoSchema, LoginDtoSchema } from "./dto";

export const AUTH_CONTROLLER = createToken<AuthController>("AUTH_CONTROLLER");

export class AuthController extends HttpController {
  constructor(
    private readonly authService: AuthService,
    private readonly guardFactory: AuthGuardFactory,
    private readonly authConfig: AuthConfig,
  ) {
    super();
  }

  routes() {
    const loginRateLimit = createLoginRateLimitMiddleware(this.authConfig);
    const authMutationRateLimit = createAuthMutationRateLimitMiddleware(
      this.authConfig,
    );
    const csrfMiddleware = this.guardFactory.requireCsrf();

    return this.router()
      .post("/auth/login", this.login, {
        middlewares: [loginRateLimit],
        docs: {
          tags: ["Auth"],
          summary: "Authenticate user",
          requestBody: {
            required: true,
            schema: LoginDtoSchema.toOpenApi(),
          },
          responses: {
            200: {
              description: "Authenticated session payload",
              schema: AuthResultDtoSchema.toOpenApi(),
            },
          },
        },
      })
      .post("/auth/refresh", this.refresh, {
        middlewares: [authMutationRateLimit, csrfMiddleware],
        docs: {
          tags: ["Auth"],
          summary: "Refresh access token",
          security: [{ accessTokenCookie: [] }, { csrfHeader: [] }],
          responses: {
            200: {
              description: "Refreshed session payload",
              schema: AuthResultDtoSchema.toOpenApi(),
            },
          },
        },
      })
      .post("/auth/logout", this.logout, {
        middlewares: [authMutationRateLimit, csrfMiddleware],
        docs: {
          tags: ["Auth"],
          summary: "Logout current session",
          security: [{ accessTokenCookie: [] }, { csrfHeader: [] }],
          responses: {
            200: {
              description: "Logout result",
              schema: {
                type: "object",
                properties: {
                  loggedOut: { type: "boolean" },
                },
                required: ["loggedOut"],
                additionalProperties: false,
              },
            },
          },
        },
      })
      .get("/auth/me", this.me, {
        middlewares: [this.guardFactory.requireProtectedRoute()],
        docs: {
          tags: ["Auth"],
          summary: "Current authenticated token claims",
          security: [{ bearerAuth: [] }, { accessTokenCookie: [] }],
          responses: {
            200: {
              description: "Token claims",
              schema: {
                type: "object",
                properties: {
                  sub: { type: "string" },
                  sid: { type: "string" },
                  tokenType: { type: "string", enum: ["access", "refresh"] },
                  email: { type: "string", format: "email" },
                  role: { type: "string" },
                  iat: { type: "number" },
                  exp: { type: "number" },
                },
                required: [
                  "sub",
                  "sid",
                  "tokenType",
                  "email",
                  "role",
                  "iat",
                  "exp",
                ],
                additionalProperties: false,
              },
            },
          },
        },
      })
      .build();
  }

  async login(ctx: HttpContext) {
    const payload = LoginDtoSchema.parse(ctx.body);
    const authResult = await this.authService.login(
      payload.email,
      payload.password,
    );
    const cookieSecurity = createCookieSecurityOptions(
      this.authConfig.secureCookies,
      this.authConfig.cookieDomain,
    );

    return response(
      {
        accessToken: authResult.accessToken,
        csrfToken: authResult.csrfToken,
        tokenType: authResult.tokenType,
        expiresIn: authResult.accessExpiresIn,
        user: authResult.user,
      },
      {
        headers: {
          "set-cookie": [
            serializeAccessTokenCookie(
              authResult.accessToken,
              authResult.accessExpiresIn,
              cookieSecurity,
            ),
            serializeRefreshTokenCookie(
              authResult.refreshToken,
              authResult.refreshExpiresIn,
              cookieSecurity,
            ),
            serializeCsrfTokenCookie(
              authResult.csrfToken,
              authResult.refreshExpiresIn,
              cookieSecurity,
            ),
          ],
        },
      },
    );
  }

  async refresh(ctx: HttpContext) {
    const refreshToken = readRefreshTokenFromCookieHeader(
      ctx.req.headers.cookie,
    );
    if (!refreshToken) {
      throw new UnauthorizedException("Missing refresh token");
    }

    const refreshed = await this.authService.refresh(refreshToken);
    const cookieSecurity = createCookieSecurityOptions(
      this.authConfig.secureCookies,
      this.authConfig.cookieDomain,
    );

    return response(
      {
        accessToken: refreshed.accessToken,
        csrfToken: refreshed.csrfToken,
        tokenType: refreshed.tokenType,
        expiresIn: refreshed.accessExpiresIn,
        user: refreshed.user,
      },
      {
        headers: {
          "set-cookie": [
            serializeAccessTokenCookie(
              refreshed.accessToken,
              refreshed.accessExpiresIn,
              cookieSecurity,
            ),
            serializeRefreshTokenCookie(
              refreshed.refreshToken,
              refreshed.refreshExpiresIn,
              cookieSecurity,
            ),
            serializeCsrfTokenCookie(
              refreshed.csrfToken,
              refreshed.refreshExpiresIn,
              cookieSecurity,
            ),
          ],
        },
      },
    );
  }

  async logout(ctx: HttpContext) {
    const refreshToken = readRefreshTokenFromCookieHeader(
      ctx.req.headers.cookie,
    );
    await this.authService.logout(refreshToken);
    const cookieSecurity = createCookieSecurityOptions(
      this.authConfig.secureCookies,
      this.authConfig.cookieDomain,
    );

    return response(
      { loggedOut: true },
      {
        headers: {
          "set-cookie": serializeAuthCookieClears(cookieSecurity),
        },
      },
    );
  }

  async me(ctx: HttpContext) {
    const auth = ctx.state.auth as JwtClaims | undefined;
    if (!auth) {
      throw new UnauthorizedException("Not authenticated");
    }

    return {
      sub: auth.sub,
      sid: auth.sid,
      tokenType: auth.tokenType,
      email: auth.email,
      role: auth.role,
      iat: auth.iat,
      exp: auth.exp,
    };
  }
}
