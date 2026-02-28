import { classProvider, defineModule, factoryProvider } from "@trinacria/core";
import { httpProvider } from "@trinacria/http";
import {
  CONFIG_SERVICE,
  ConfigService,
} from "../../global-service/config.service";
import { PRISMA_SERVICE } from "../../global-service/prisma.service";
import { AUTH_CONFIG, AuthConfig } from "./auth.config";
import { AUTH_CONTROLLER, AuthController } from "./auth.controller";
import { AUTH_GUARD_FACTORY, AuthGuardFactory } from "./auth-guard.factory";
import { AUTH_SERVICE, AuthService } from "./auth.service";
import { Hs256JwtSigner, JWT_SIGNER } from "./jwt";

export const AuthModule = defineModule({
  name: "AuthModule",
  providers: [
    factoryProvider(
      AUTH_CONFIG,
      (appConfig: ConfigService): AuthConfig => ({
        jwtSecret: appConfig.get("SECRET_KEY"),
        accessTokenTtlSeconds: appConfig.get("JWT_ACCESS_TOKEN_TTL_SECONDS"),
        refreshTokenTtlSeconds: appConfig.get("JWT_REFRESH_TOKEN_TTL_SECONDS"),
        trustProxy: false,
        cookieDomain: appConfig.get("AUTH_COOKIE_DOMAIN"),
        secureCookies: appConfig.get("ENV") === "production",
      }),
      [CONFIG_SERVICE],
    ),
    factoryProvider(
      JWT_SIGNER,
      (config: AuthConfig) => new Hs256JwtSigner(config.jwtSecret),
      [AUTH_CONFIG],
    ),
    factoryProvider(
      AUTH_SERVICE,
      (signer, prisma, config: AuthConfig) =>
        new AuthService(
          signer,
          prisma,
          config.accessTokenTtlSeconds,
          config.refreshTokenTtlSeconds,
        ),
      [JWT_SIGNER, PRISMA_SERVICE, AUTH_CONFIG],
    ),
    classProvider(AUTH_GUARD_FACTORY, AuthGuardFactory, [AUTH_SERVICE]),
    httpProvider(AUTH_CONTROLLER, AuthController, [
      AUTH_SERVICE,
      AUTH_GUARD_FACTORY,
      AUTH_CONFIG,
    ]),
  ],
  exports: [AUTH_CONTROLLER, AUTH_GUARD_FACTORY, AUTH_SERVICE],
});
