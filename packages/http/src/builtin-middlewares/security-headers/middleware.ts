import {
  DEFAULT_HEADERS,
  DEFAULT_HSTS_MAX_AGE,
  SECURITY_PRESETS,
} from "./constants";
import { getCachedHeaderEntries } from "./cache";
import { compileContentSecurityPolicy } from "./csp";
import { hasResponseHeader, isHttpsRequest, resolveMode } from "./helpers";
import {
  cloneSecurityHeadersOptions,
  mergeSecurityHeadersOptions,
} from "./options";
import { buildPermissionsPolicyHeader } from "./permissions";
import {
  assertSafeHeaderValue,
  validateHeaders,
  validateStrictTransportSecurityOptions,
} from "./validation";
import type {
  HeaderValue,
  SecurityHeadersBuilder,
  SecurityHeadersOptions,
  SecurityHeadersPreset,
  StrictTransportSecurityOptions,
  TrinacriaSecurityMode,
} from "./types";

/**
 * Returns a reusable preset object for security headers.
 */
export function securityHeadersPreset(
  name: SecurityHeadersPreset,
): SecurityHeadersOptions {
  return cloneSecurityHeadersOptions(SECURITY_PRESETS[name]);
}

/**
 * Fluent API for building security headers configuration safely.
 */
export function createSecurityHeadersBuilder(
  initial: SecurityHeadersOptions = {},
): SecurityHeadersBuilder {
  let state = cloneSecurityHeadersOptions(initial);

  const api: SecurityHeadersBuilder = {
    preset(name) {
      state = mergeSecurityHeadersOptions(state, securityHeadersPreset(name));
      return api;
    },
    mode(value) {
      state = mergeSecurityHeadersOptions(state, { mode: value });
      return api;
    },
    trustProxy(value) {
      state = mergeSecurityHeadersOptions(state, { trustProxy: value });
      return api;
    },
    headers(value) {
      state = mergeSecurityHeadersOptions(state, { headers: value });
      return api;
    },
    contentSecurityPolicy(value) {
      state = mergeSecurityHeadersOptions(state, {
        contentSecurityPolicy: value,
      });
      return api;
    },
    strictTransportSecurity(value) {
      state = mergeSecurityHeadersOptions(state, {
        strictTransportSecurity: value,
      });
      return api;
    },
    permissionsPolicy(value, validation) {
      state = mergeSecurityHeadersOptions(state, {
        permissionsPolicy: value,
        permissionsPolicyValidation:
          validation ?? state.permissionsPolicyValidation,
      });
      return api;
    },
    crossOriginEmbedderPolicy(value) {
      state = mergeSecurityHeadersOptions(state, {
        crossOriginEmbedderPolicy: value,
      });
      return api;
    },
    buildOptions() {
      return cloneSecurityHeadersOptions(state);
    },
    build() {
      return securityHeaders(state);
    },
  };

  return api;
}

/**
 * Helmet-like middleware for Trinacria HTTP.
 */
export function securityHeaders(options: SecurityHeadersOptions = {}) {
  const mode = resolveMode(options.mode);
  const trustProxy = options.trustProxy ?? false;
  const headers = buildBaseHeaders(options, mode);
  const headerEntries = getCachedHeaderEntries(
    buildHeaderEntriesCacheKey(headers),
    () => {
      const entries: Array<[string, string]> = [];

      for (const [name, value] of Object.entries(headers)) {
        if (value === false) {
          continue;
        }

        assertSafeHeaderValue(name, value);
        entries.push([name, value]);
      }

      return entries;
    },
  );

  const compiledCsp = compileContentSecurityPolicy(
    options.contentSecurityPolicy,
    mode,
  );

  const hstsConfig = normalizeStrictTransportSecurity(
    options.strictTransportSecurity,
    mode,
  );

  const hstsValue = hstsConfig
    ? buildStrictTransportSecurityHeader(hstsConfig)
    : undefined;

  return async (
    ctx: {
      req: import("node:http").IncomingMessage;
      res: import("node:http").ServerResponse;
      state: Record<string, unknown>;
    },
    next: () => Promise<unknown>,
  ) => {
    for (const [name, value] of headerEntries) {
      if (hasResponseHeader(ctx.res, name)) {
        continue;
      }

      ctx.res.setHeader(name, value);
    }

    if (compiledCsp && !hasResponseHeader(ctx.res, compiledCsp.name)) {
      const csp = compiledCsp.build();
      assertSafeHeaderValue(compiledCsp.name, csp.value);
      ctx.res.setHeader(compiledCsp.name, csp.value);

      if (csp.nonce && csp.nonceStateKey) {
        ctx.state[csp.nonceStateKey] = csp.nonce;
      }
    }

    if (
      compiledCsp?.reportToHeaderValue &&
      !hasResponseHeader(ctx.res, "report-to")
    ) {
      assertSafeHeaderValue("report-to", compiledCsp.reportToHeaderValue);
      ctx.res.setHeader("report-to", compiledCsp.reportToHeaderValue);
    }

    if (
      hstsValue &&
      isHttpsRequest(ctx.req, trustProxy) &&
      !hasResponseHeader(ctx.res, "strict-transport-security")
    ) {
      ctx.res.setHeader("strict-transport-security", hstsValue);
    }

    return next();
  };
}

function buildBaseHeaders(
  options: SecurityHeadersOptions,
  mode: TrinacriaSecurityMode,
): Record<string, HeaderValue> {
  validateHeaders(options.headers);

  const validationMode = options.permissionsPolicyValidation ?? "warn";
  const extraHeaders: Record<string, HeaderValue> = {};

  if (options.permissionsPolicy !== undefined) {
    extraHeaders["permissions-policy"] = buildPermissionsPolicyHeader(
      options.permissionsPolicy,
      validationMode,
      mode,
    );
  }

  if (options.crossOriginEmbedderPolicy !== undefined) {
    extraHeaders["cross-origin-embedder-policy"] =
      options.crossOriginEmbedderPolicy;
  }

  return {
    ...DEFAULT_HEADERS,
    ...extraHeaders,
    ...(options.headers ?? {}),
  };
}

function buildHeaderEntriesCacheKey(
  headers: Record<string, HeaderValue>,
): string {
  return Object.entries(headers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value === false ? "__disabled__" : value}`)
    .join("|");
}

function normalizeStrictTransportSecurity(
  options: false | StrictTransportSecurityOptions | undefined,
  mode: TrinacriaSecurityMode,
): StrictTransportSecurityOptions | null {
  if (options === false) {
    return null;
  }

  if (mode === "development" && options === undefined) {
    return null;
  }

  validateStrictTransportSecurityOptions(options);

  return {
    maxAge: options?.maxAge ?? DEFAULT_HSTS_MAX_AGE,
    includeSubDomains: options?.includeSubDomains ?? true,
    preload: mode === "production" ? (options?.preload ?? false) : false,
  };
}

function buildStrictTransportSecurityHeader(
  options: StrictTransportSecurityOptions,
): string {
  const maxAge = options.maxAge ?? DEFAULT_HSTS_MAX_AGE;
  const parts = [`max-age=${Math.max(0, Math.floor(maxAge))}`];

  if (options.includeSubDomains !== false) {
    parts.push("includeSubDomains");
  }

  if (options.preload) {
    parts.push("preload");
  }

  return parts.join("; ");
}
