import {
  FLAG_CSP_DIRECTIVES,
  KNOWN_CSP_DIRECTIVES,
  QUOTED_CSP_KEYWORDS,
  SINGLE_VALUE_CSP_DIRECTIVES,
} from "./constants";
import type {
  ContentSecurityPolicyOptions,
  HeaderValue,
  StrictTransportSecurityOptions,
  ValidationMode,
} from "./types";

export function assertNoCrlf(value: string, context: string): void {
  if (/[\r\n]/.test(value)) {
    throw new TypeError(
      `Invalid header value for "${context}": CRLF characters are not allowed`,
    );
  }
}

export function assertSafeHeaderValue(name: string, value: string): void {
  assertNoCrlf(value, name);
}

export function validateHeaders(
  headers: Record<string, HeaderValue> | undefined,
): void {
  if (!headers) {
    return;
  }

  for (const [key, value] of Object.entries(headers)) {
    if (typeof key !== "string" || key.trim() === "") {
      throw new TypeError("Header name must be a non-empty string");
    }

    if (value !== false && typeof value !== "string") {
      throw new TypeError(`Invalid header value for "${key}"`);
    }

    if (typeof value === "string") {
      assertNoCrlf(value, key);
    }
  }
}

export function validateCspOptions(
  options: ContentSecurityPolicyOptions | undefined,
): void {
  if (!options) {
    return;
  }

  const validationMode = options.schemaValidation ?? "warn";

  if (options.reportUri) {
    assertNoCrlf(options.reportUri, "contentSecurityPolicy.reportUri");
  }

  if (options.reportTo) {
    assertNoCrlf(options.reportTo, "contentSecurityPolicy.reportTo");
  }

  if (!options.directives) {
    return;
  }

  for (const [directive, sources] of Object.entries(options.directives)) {
    validateCspDirectiveName(directive, validationMode);

    if (!Array.isArray(sources)) {
      throw new TypeError(
        `Invalid CSP directive "${directive}": expected string[]`,
      );
    }

    validateCspDirectiveShape(directive, sources, validationMode);

    for (const source of sources) {
      if (typeof source !== "string" || source.trim() === "") {
        throw new TypeError(
          `Invalid CSP directive value for "${directive}": expected non-empty strings`,
        );
      }

      assertNoCrlf(source, `contentSecurityPolicy.directives.${directive}`);
      validateCspSourceToken(source, directive, validationMode);
    }
  }
}

export function validateStrictTransportSecurityOptions(
  options: StrictTransportSecurityOptions | undefined,
): void {
  if (options?.maxAge === undefined) {
    return;
  }

  if (!Number.isFinite(options.maxAge) || options.maxAge < 0) {
    throw new RangeError("strictTransportSecurity.maxAge must be >= 0");
  }
}

function validateCspDirectiveName(
  directive: string,
  validationMode: ValidationMode,
): void {
  if (!/^[a-z-]+$/.test(directive)) {
    throw new TypeError(`Invalid CSP directive name "${directive}"`);
  }

  if (KNOWN_CSP_DIRECTIVES.has(directive)) {
    return;
  }

  if (validationMode === "strict") {
    throw new TypeError(
      `Unknown CSP directive "${directive}". Set schemaValidation to "off" or "warn" to allow it.`,
    );
  }

  if (validationMode === "warn") {
    console.warn(`[securityHeaders] Unknown CSP directive "${directive}"`);
  }
}

function validateCspDirectiveShape(
  directive: string,
  sources: string[],
  validationMode: ValidationMode,
): void {
  if (FLAG_CSP_DIRECTIVES.has(directive) && sources.length > 0) {
    throw new TypeError(
      `CSP directive "${directive}" must not include sources (use empty array)`,
    );
  }

  if (SINGLE_VALUE_CSP_DIRECTIVES.has(directive) && sources.length > 1) {
    throw new TypeError(`CSP directive "${directive}" accepts a single value`);
  }

  if (!FLAG_CSP_DIRECTIVES.has(directive) && sources.length === 0) {
    if (validationMode === "strict") {
      throw new TypeError(
        `CSP directive "${directive}" requires at least one source token`,
      );
    }

    if (validationMode === "warn") {
      console.warn(
        `[securityHeaders] CSP directive "${directive}" should include at least one source token`,
      );
    }
  }
}

function validateCspSourceToken(
  source: string,
  directive: string,
  validationMode: ValidationMode,
): void {
  if (/\s/.test(source)) {
    throw new TypeError(
      `Invalid CSP source token "${source}" for "${directive}": spaces are not allowed`,
    );
  }

  if (
    source.startsWith("'nonce-") &&
    !/^'nonce-[a-zA-Z0-9+/_-]+={0,2}'$/.test(source)
  ) {
    throw new TypeError(
      `Invalid CSP nonce token "${source}" for "${directive}"`,
    );
  }

  if (
    source.startsWith("'sha") &&
    !/^'sha(256|384|512)-[a-zA-Z0-9+/=]+'$/.test(source)
  ) {
    throw new TypeError(
      `Invalid CSP hash token "${source}" for "${directive}"`,
    );
  }

  if (!source.startsWith("'") || !source.endsWith("'")) {
    if (QUOTED_CSP_KEYWORDS.has(source)) {
      throw new TypeError(
        `CSP keyword "${source}" in "${directive}" must be quoted`,
      );
    }

    if (validationMode === "warn" && source.startsWith("unsafe-")) {
      console.warn(
        `[securityHeaders] CSP source "${source}" in "${directive}" may require single quotes`,
      );
    }
  }
}
