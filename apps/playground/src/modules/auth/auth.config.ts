import { createToken } from "@trinacria/core";

export interface AuthConfig {
  jwtSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  trustProxy: boolean;
  cookieDomain?: string;
  secureCookies: boolean;
}

export const AUTH_CONFIG = createToken<AuthConfig>("AUTH_CONFIG");
