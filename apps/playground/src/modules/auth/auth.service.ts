import { timingSafeEqual } from "node:crypto";
import { createToken } from "@trinacria/core";
import { ForbiddenException, UnauthorizedException } from "@trinacria/http";
import * as argon2 from "argon2";
import type { Prisma } from "../../generated/prisma/client";
import type { PrismaService } from "../../global-service/prisma.service";
import type { AuthLoginResult, AuthRefreshResult } from "./auth.types";
import { type JwtClaims, type JwtSigner, JwtVerificationError } from "./jwt";

const authLoginUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  passwordHash: true,
} satisfies Prisma.UserSelect;

const publicAuthUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} satisfies Prisma.UserSelect;

type PublicAuthUserRecord = Prisma.UserGetPayload<{
  select: typeof publicAuthUserSelect;
}>;

const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$GA6N2zm4o/W3tepMdZwGSQ$0EZj0LVjyConOfdFJwei8V4Eiz62C5voRZPjU3prhlg";

export const AUTH_SERVICE = createToken<AuthService>("AUTH_SERVICE");

export class AuthService {
  constructor(
    private readonly signer: JwtSigner,
    private readonly prisma: PrismaService,
    readonly accessTokenTtlSeconds: number,
    readonly refreshTokenTtlSeconds: number,
  ) {}

  async login(email: string, password: string): Promise<AuthLoginResult> {
    const userRecord = await this.prisma.user.findUnique({
      where: {
        email: email.trim().toLowerCase(),
      },
      select: authLoginUserSelect,
    });

    if (!userRecord) {
      await argon2.verify(DUMMY_PASSWORD_HASH, password);
      throw new UnauthorizedException("Invalid credentials");
    }

    const matches = await argon2.verify(userRecord.passwordHash, password);
    if (!matches) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const refreshExpiresAt = new Date(
      Date.now() + this.refreshTokenTtlSeconds * 1000,
    );

    const session = await this.prisma.authSession.create({
      data: {
        csrfToken: crypto.randomUUID(),
        expiresAt: refreshExpiresAt,
        userId: userRecord.id,
      },
      select: {
        sid: true,
        csrfToken: true,
      },
    });

    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(userRecord, session.sid),
      this.signRefreshToken(userRecord, session.sid),
    ]);

    return {
      accessToken,
      refreshToken,
      csrfToken: session.csrfToken,
      tokenType: "Bearer",
      accessExpiresIn: this.accessTokenTtlSeconds,
      refreshExpiresIn: this.refreshTokenTtlSeconds,
      sessionsCreated: 1,
      user: {
        id: userRecord.id,
        name: userRecord.name,
        email: userRecord.email,
        role: userRecord.role,
      },
    };
  }

  async refresh(refreshToken: string): Promise<AuthRefreshResult> {
    const claims = await this.verifyRefreshToken(refreshToken);

    const currentSession = await this.prisma.authSession.findUnique({
      where: { sid: claims.sid },
      include: { user: true },
    });

    if (
      !currentSession ||
      currentSession.expiresAt.getTime() <= Date.now() ||
      currentSession.user.id !== claims.sub
    ) {
      throw new UnauthorizedException("Refresh session not found");
    }

    /**
     * Rotate session identifier and CSRF token on refresh to reduce replay
     * window if an old refresh token leaks.
     */
    const rotatedSession = await this.prisma.authSession.update({
      where: { sid: currentSession.sid },
      data: {
        sid: crypto.randomUUID(),
        csrfToken: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + this.refreshTokenTtlSeconds * 1000),
      },
      select: {
        sid: true,
        csrfToken: true,
        user: {
          select: publicAuthUserSelect,
        },
      },
    });

    const [nextAccessToken, nextRefreshToken] = await Promise.all([
      this.signAccessToken(rotatedSession.user, rotatedSession.sid),
      this.signRefreshToken(rotatedSession.user, rotatedSession.sid),
    ]);

    return {
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
      csrfToken: rotatedSession.csrfToken,
      tokenType: "Bearer",
      accessExpiresIn: this.accessTokenTtlSeconds,
      refreshExpiresIn: this.refreshTokenTtlSeconds,
      user: rotatedSession.user,
    };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }

    try {
      const claims = await this.verifyRefreshToken(refreshToken);
      await this.prisma.authSession.deleteMany({
        where: { sid: claims.sid },
      });
    } catch {
      // If token is malformed/expired we still clear client cookies.
    }
  }

  async verifyAccessToken(token: string): Promise<JwtClaims> {
    try {
      const claims = await this.signer.verify(token);
      if (claims.tokenType !== "access") {
        throw new JwtVerificationError("Invalid token type");
      }

      const session = await this.prisma.authSession.findUnique({
        where: { sid: claims.sid },
        select: {
          expiresAt: true,
          user: { select: publicAuthUserSelect },
        },
      });
      if (
        !session ||
        session.expiresAt.getTime() <= Date.now() ||
        session.user.id !== claims.sub
      ) {
        throw new JwtVerificationError("Session is revoked or expired");
      }

      return {
        ...claims,
        email: session.user.email,
        role: session.user.role,
      };
    } catch (error) {
      if (error instanceof JwtVerificationError) {
        throw new UnauthorizedException("Invalid or expired token");
      }

      throw error;
    }
  }

  async verifySessionCsrf(
    sid: string,
    cookieToken: string | undefined,
    headerToken: string | undefined,
  ): Promise<void> {
    if (!safeTokenEqual(cookieToken, headerToken)) {
      throw new ForbiddenException("Invalid CSRF token");
    }

    const session = await this.prisma.authSession.findUnique({
      where: { sid },
      select: { csrfToken: true, expiresAt: true },
    });
    if (
      !session ||
      session.expiresAt.getTime() <= Date.now() ||
      !safeTokenEqual(session.csrfToken, cookieToken)
    ) {
      throw new ForbiddenException("Invalid or expired CSRF session");
    }
  }

  async verifyRefreshRequest(
    refreshToken: string | undefined,
    cookieCsrf: string | undefined,
    headerCsrf: string | undefined,
  ): Promise<void> {
    if (!refreshToken) {
      throw new UnauthorizedException("Missing refresh token");
    }
    const claims = await this.verifyRefreshToken(refreshToken);
    await this.verifySessionCsrf(claims.sid, cookieCsrf, headerCsrf);
  }

  private async verifyRefreshToken(token: string): Promise<JwtClaims> {
    try {
      const claims = await this.signer.verify(token);
      if (claims.tokenType !== "refresh") {
        throw new JwtVerificationError("Invalid token type");
      }

      return claims;
    } catch (error) {
      if (error instanceof JwtVerificationError) {
        throw new UnauthorizedException("Invalid or expired refresh token");
      }

      throw error;
    }
  }

  private async signAccessToken(
    user: PublicAuthUserRecord,
    sid: string,
  ): Promise<string> {
    return this.signer.sign(
      {
        sub: user.id,
        sid,
        tokenType: "access",
        email: user.email,
        role: user.role,
      },
      this.accessTokenTtlSeconds,
    );
  }

  private async signRefreshToken(
    user: PublicAuthUserRecord,
    sid: string,
  ): Promise<string> {
    return this.signer.sign(
      {
        sub: user.id,
        sid,
        tokenType: "refresh",
        email: user.email,
        role: user.role,
      },
      this.refreshTokenTtlSeconds,
    );
  }
}

function safeTokenEqual(
  left: string | undefined,
  right: string | undefined,
): boolean {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
