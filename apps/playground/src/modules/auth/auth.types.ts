export interface PublicAuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AuthLoginResult {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  tokenType: "Bearer";
  accessExpiresIn: number;
  refreshExpiresIn: number;
  user: PublicAuthUser;
}

export interface AuthRefreshResult {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  tokenType: "Bearer";
  accessExpiresIn: number;
  refreshExpiresIn: number;
  user: PublicAuthUser;
}
