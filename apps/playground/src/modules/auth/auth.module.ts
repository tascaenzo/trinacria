import {
  classProvider,
  defineModule,
  factoryProvider,
} from "@trinacria/core";
import { httpProvider } from "@trinacria/http";
import {
  APP_CONFIG,
  type AppConfig,
} from "../../global-service/app-config.service";
import { PRISMA_SERVICE } from "../../global-service/prisma.service";
import { AuthConfig } from "./auth.config";
import { AuthController } from "./auth.controller";
import { AuthGuardFactory } from "./auth-guard.factory";
import { AuthService } from "./auth.service";
import {
  AUTH_CONFIG,
  AUTH_CONTROLLER,
  AUTH_GUARD_FACTORY,
  AUTH_SERVICE,
  JWT_SIGNER,
} from "./auth.tokens";
import { Hs256JwtSigner } from "./jwt";

export const AuthModule = defineModule({
  name: "AuthModule",
  providers: [
    factoryProvider(
      AUTH_CONFIG,
      (appConfig: AppConfig): AuthConfig => ({
        jwtSecret: appConfig.JWT_SECRET,
        accessTokenTtlSeconds: appConfig.JWT_ACCESS_TOKEN_TTL_SECONDS,
        refreshTokenTtlSeconds: appConfig.JWT_REFRESH_TOKEN_TTL_SECONDS,
        trustProxy: appConfig.TRUST_PROXY,
        cookieDomain: appConfig.AUTH_COOKIE_DOMAIN,
        secureCookies: appConfig.NODE_ENV === "production",
      }),
      [APP_CONFIG],
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
