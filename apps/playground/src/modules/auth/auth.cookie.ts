export const ACCESS_TOKEN_COOKIE_NAME = "trinacria_access_token";
export const REFRESH_TOKEN_COOKIE_NAME = "trinacria_refresh_token";
export const CSRF_TOKEN_COOKIE_NAME = "trinacria_csrf_token";
export const CSRF_TOKEN_HEADER_NAME = "x-csrf-token";

export interface CookieSecurityOptions {
  secure: boolean;
  domain?: string;
}

export function serializeAccessTokenCookie(
  accessToken: string,
  maxAgeSeconds: number,
  options: CookieSecurityOptions,
): string {
  return serializeCookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, maxAgeSeconds, {
    ...options,
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
  });
}

export function serializeRefreshTokenCookie(
  refreshToken: string,
  maxAgeSeconds: number,
  options: CookieSecurityOptions,
): string {
  return serializeCookie(
    REFRESH_TOKEN_COOKIE_NAME,
    refreshToken,
    maxAgeSeconds,
    {
      ...options,
      httpOnly: true,
      sameSite: "Strict",
      path: "/auth",
    },
  );
}

export function serializeCsrfTokenCookie(
  csrfToken: string,
  maxAgeSeconds: number,
  options: CookieSecurityOptions,
): string {
  return serializeCookie(CSRF_TOKEN_COOKIE_NAME, csrfToken, maxAgeSeconds, {
    ...options,
    httpOnly: false,
    sameSite: "Strict",
    path: "/",
  });
}

export function serializeAuthCookieClears(
  options: CookieSecurityOptions,
): string[] {
  return [
    clearCookie(ACCESS_TOKEN_COOKIE_NAME, { ...options, path: "/" }),
    clearCookie(REFRESH_TOKEN_COOKIE_NAME, { ...options, path: "/auth" }),
    clearCookie(CSRF_TOKEN_COOKIE_NAME, { ...options, path: "/" }),
  ];
}

export function readAccessTokenFromCookieHeader(
  cookieHeader: string | string[] | undefined,
): string | undefined {
  return readCookie(cookieHeader, ACCESS_TOKEN_COOKIE_NAME);
}

export function readRefreshTokenFromCookieHeader(
  cookieHeader: string | string[] | undefined,
): string | undefined {
  return readCookie(cookieHeader, REFRESH_TOKEN_COOKIE_NAME);
}

export function readCsrfTokenFromCookieHeader(
  cookieHeader: string | string[] | undefined,
): string | undefined {
  return readCookie(cookieHeader, CSRF_TOKEN_COOKIE_NAME);
}

function serializeCookie(
  name: string,
  value: string,
  maxAgeSeconds: number,
  options: CookieSecurityOptions & {
    httpOnly: boolean;
    sameSite: "Lax" | "Strict";
    path: string;
  },
): string {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path}`,
    `Max-Age=${maxAgeSeconds}`,
    `SameSite=${options.sameSite}`,
  ];

  if (options.httpOnly) {
    attributes.push("HttpOnly");
  }

  if (options.secure) {
    attributes.push("Secure");
  }

  if (options.domain) {
    attributes.push(`Domain=${options.domain}`);
  }

  return attributes.join("; ");
}

function clearCookie(
  name: string,
  options: CookieSecurityOptions & { path: string },
): string {
  const attributes = [
    `${name}=`,
    `Path=${options.path}`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "SameSite=Lax",
  ];

  if (options.secure) {
    attributes.push("Secure");
  }

  if (options.domain) {
    attributes.push(`Domain=${options.domain}`);
  }

  return attributes.join("; ");
}

function readCookie(
  cookieHeader: string | string[] | undefined,
  targetName: string,
): string | undefined {
  if (typeof cookieHeader !== "string" || cookieHeader.length === 0) {
    return undefined;
  }

  const cookies = cookieHeader.split(";");
  for (const item of cookies) {
    const [rawName, ...valueParts] = item.trim().split("=");
    if (!rawName || valueParts.length === 0 || rawName !== targetName) {
      continue;
    }

    const rawValue = valueParts.join("=");
    if (!rawValue) {
      return undefined;
    }

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return undefined;
}
