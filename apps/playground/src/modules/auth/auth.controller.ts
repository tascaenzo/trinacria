import {
  BadRequestException,
  HttpController,
  HttpContext,
  HttpMiddleware,
  UnauthorizedException,
  rateLimit,
  response,
} from "@trinacria/http";
import { ValidationError, toOpenApi, type Schema } from "@trinacria/schema";
import { AuthConfig } from "./auth.config";
import { AuthGuardFactory } from "./auth-guard.factory";
import {
  readRefreshTokenFromCookieHeader,
  serializeAccessTokenCookie,
  serializeAuthCookieClears,
  serializeCsrfTokenCookie,
  serializeRefreshTokenCookie,
} from "./auth.cookie";
import { AuthService } from "./auth.service";
import { JwtClaims } from "./jwt";
import { LoginDto, LoginDtoSchema } from "./dto";

export class AuthController extends HttpController {
  constructor(
    private readonly authService: AuthService,
    private readonly guardFactory: AuthGuardFactory,
    private readonly authConfig: AuthConfig,
  ) {
    super();
  }

  routes() {
    const loginRateLimit = this.createLoginRateLimitMiddleware();
    const authMutationRateLimit = this.createAuthMutationRateLimitMiddleware();
    const csrfMiddleware = this.guardFactory.requireCsrf();

    return this.router()
      .post("/auth/login", this.login, {
        middlewares: [loginRateLimit],
        docs: {
          tags: ["Auth"],
          summary: "Authenticate user",
          requestBody: {
            required: true,
            schema: toOpenApi(LoginDtoSchema),
          },
          responses: {
            200: {
              description: "Authenticated session payload",
              schema: authResultSchema(),
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
              schema: authResultSchema(),
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
        middlewares: [this.guardFactory.requireAuth()],
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
                required: ["sub", "sid", "tokenType", "email", "role", "iat", "exp"],
                additionalProperties: false,
              },
            },
          },
        },
      })
      .build();
  }

  async login(ctx: HttpContext) {
    const payload = parseDto(LoginDtoSchema, ctx.body);
    const authResult = await this.authService.login(payload.email, payload.password);

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
              cookieOptions(this.authConfig),
            ),
            serializeRefreshTokenCookie(
              authResult.refreshToken,
              authResult.refreshExpiresIn,
              cookieOptions(this.authConfig),
            ),
            serializeCsrfTokenCookie(
              authResult.csrfToken,
              authResult.refreshExpiresIn,
              cookieOptions(this.authConfig),
            ),
          ],
        },
      },
    );
  }

  async refresh(ctx: HttpContext) {
    const refreshToken = readRefreshTokenFromCookieHeader(ctx.req.headers.cookie);
    if (!refreshToken) {
      throw new UnauthorizedException("Missing refresh token");
    }

    const refreshed = await this.authService.refresh(refreshToken);

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
              cookieOptions(this.authConfig),
            ),
            serializeRefreshTokenCookie(
              refreshed.refreshToken,
              refreshed.refreshExpiresIn,
              cookieOptions(this.authConfig),
            ),
            serializeCsrfTokenCookie(
              refreshed.csrfToken,
              refreshed.refreshExpiresIn,
              cookieOptions(this.authConfig),
            ),
          ],
        },
      },
    );
  }

  async logout(ctx: HttpContext) {
    const refreshToken = readRefreshTokenFromCookieHeader(ctx.req.headers.cookie);
    await this.authService.logout(refreshToken);

    return response(
      { loggedOut: true },
      {
        headers: {
          "set-cookie": serializeAuthCookieClears(cookieOptions(this.authConfig)),
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

  private createLoginRateLimitMiddleware(): HttpMiddleware {
    return rateLimit({
      trustProxy: this.authConfig.trustProxy,
      windowMs: 60_000,
      max: 10,
      keyGenerator: (ctx) => {
        const body = asRecord(ctx.body);
        const email = typeof body?.email === "string" ? body.email.toLowerCase() : "unknown";
        const ip = resolveClientAddress(ctx, this.authConfig.trustProxy);
        return `auth:login:${ip}:${email}`;
      },
    });
  }

  private createAuthMutationRateLimitMiddleware(): HttpMiddleware {
    return rateLimit({
      trustProxy: this.authConfig.trustProxy,
      windowMs: 60_000,
      max: 30,
      keyGenerator: (ctx) => {
        const ip = resolveClientAddress(ctx, this.authConfig.trustProxy);
        return `auth:mutation:${ip}`;
      },
    });
  }
}

function authResultSchema() {
  return {
    type: "object",
    properties: {
      accessToken: { type: "string" },
      csrfToken: { type: "string" },
      tokenType: { type: "string", enum: ["Bearer"] },
      expiresIn: { type: "number" },
      user: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          role: { type: "string" },
        },
        required: ["id", "name", "email", "role"],
        additionalProperties: false,
      },
    },
    required: ["accessToken", "csrfToken", "tokenType", "expiresIn", "user"],
    additionalProperties: false,
  };
}

function cookieOptions(config: AuthConfig) {
  return {
    secure: config.secureCookies,
    domain: config.cookieDomain,
  };
}

function parseDto<T>(schema: Schema<T>, body: unknown): T {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ValidationError) {
      const firstIssue = error.issues[0];
      const path = firstIssue.path.map(String).join(".");
      const message = path
        ? `Invalid "${path}": ${firstIssue.message}`
        : firstIssue.message;

      throw new BadRequestException(message);
    }

    throw error;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function resolveClientAddress(ctx: HttpContext, trustProxy: boolean): string {
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
