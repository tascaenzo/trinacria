export interface AuthConfig {
  jwtSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  trustProxy: boolean;
  cookieDomain?: string;
  secureCookies: boolean;
}
