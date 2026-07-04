import type {
  HeaderValue,
  SecurityHeadersOptions,
  SecurityHeadersPreset,
} from "./types";

export type HeaderMap = Record<string, HeaderValue>;

export const CACHE_LIMIT = 256;
export const DEFAULT_HSTS_MAX_AGE = 31_536_000;
export const DEFAULT_NONCE_STATE_KEY = "cspNonce";

export const QUOTED_CSP_KEYWORDS = new Set([
  "self",
  "none",
  "unsafe-inline",
  "unsafe-eval",
  "unsafe-hashes",
  "unsafe-allow-redirects",
  "strict-dynamic",
  "report-sample",
  "wasm-unsafe-eval",
]);

export const FLAG_CSP_DIRECTIVES = new Set([
  "upgrade-insecure-requests",
  "block-all-mixed-content",
]);

export const SINGLE_VALUE_CSP_DIRECTIVES = new Set(["report-uri", "report-to"]);

export const KNOWN_CSP_DIRECTIVES = new Set([
  "default-src",
  "script-src",
  "script-src-elem",
  "script-src-attr",
  "style-src",
  "style-src-elem",
  "style-src-attr",
  "img-src",
  "font-src",
  "connect-src",
  "media-src",
  "object-src",
  "child-src",
  "frame-src",
  "worker-src",
  "manifest-src",
  "base-uri",
  "form-action",
  "frame-ancestors",
  "sandbox",
  "report-uri",
  "report-to",
  "require-trusted-types-for",
  "trusted-types",
  "upgrade-insecure-requests",
  "block-all-mixed-content",
  "navigate-to",
  "prefetch-src",
]);

export const KNOWN_PERMISSIONS_POLICY_FEATURES = new Set<string>([
  "accelerometer",
  "ambient-light-sensor",
  "autoplay",
  "battery",
  "camera",
  "clipboard-read",
  "clipboard-write",
  "cross-origin-isolated",
  "display-capture",
  "document-domain",
  "encrypted-media",
  "fullscreen",
  "geolocation",
  "gyroscope",
  "hid",
  "identity-credentials-get",
  "idle-detection",
  "keyboard-map",
  "magnetometer",
  "microphone",
  "midi",
  "payment",
  "picture-in-picture",
  "publickey-credentials-get",
  "screen-wake-lock",
  "serial",
  "speaker-selection",
  "sync-xhr",
  "usb",
  "web-share",
  "window-management",
  "xr-spatial-tracking",
]);

export const DEFAULT_HEADERS: HeaderMap = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "SAMEORIGIN",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-dns-prefetch-control": "off",
  "x-download-options": "noopen",
  "x-permitted-cross-domain-policies": "none",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "cross-origin-embedder-policy": false,
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "origin-agent-cluster": "?1",
};

export const DEFAULT_CSP_DIRECTIVES: Record<string, string[]> = {
  "default-src": ["'self'"],
  "base-uri": ["'self'"],
  "frame-ancestors": ["'none'"],
  "object-src": ["'none'"],
  "script-src": ["'self'"],
  "style-src": ["'self'"],
  "img-src": ["'self'", "data:"],
  "connect-src": ["'self'"],
  "font-src": ["'self'"],
  "frame-src": ["'self'"],
  "media-src": ["'self'"],
  "worker-src": ["'self'"],
  "manifest-src": ["'self'"],
  "form-action": ["'self'"],
  "upgrade-insecure-requests": [],
};

export const SECURITY_PRESETS: Record<
  SecurityHeadersPreset,
  SecurityHeadersOptions
> = {
  development: {
    mode: "development",
    trustProxy: false,
    strictTransportSecurity: false,
    contentSecurityPolicy: {
      reportOnly: true,
      schemaValidation: "warn",
    },
    permissionsPolicyValidation: "warn",
  },
  staging: {
    mode: "staging",
    trustProxy: true,
    contentSecurityPolicy: {
      reportOnly: true,
      schemaValidation: "strict",
    },
    strictTransportSecurity: {
      maxAge: DEFAULT_HSTS_MAX_AGE,
      includeSubDomains: true,
      preload: false,
    },
    permissionsPolicyValidation: "warn",
  },
  production: {
    mode: "production",
    trustProxy: true,
    contentSecurityPolicy: {
      reportOnly: false,
      schemaValidation: "strict",
    },
    strictTransportSecurity: {
      maxAge: DEFAULT_HSTS_MAX_AGE,
      includeSubDomains: true,
      preload: false,
    },
    permissionsPolicyValidation: "strict",
  },
  enterprise: {
    mode: "production",
    trustProxy: true,
    contentSecurityPolicy: {
      reportOnly: false,
      schemaValidation: "strict",
      addStrictDynamicWhenNonce: true,
    },
    strictTransportSecurity: {
      maxAge: DEFAULT_HSTS_MAX_AGE,
      includeSubDomains: true,
      preload: true,
    },
    permissionsPolicyValidation: "strict",
  },
};
