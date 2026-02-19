import { randomBytes } from "node:crypto";
import { DEFAULT_CSP_DIRECTIVES, DEFAULT_NONCE_STATE_KEY } from "./constants";
import { getCachedCspValue, stableStringify } from "./cache";
import { addSourceToken, renderCsp, renderDirective, uniq } from "./helpers";
import { buildReportToHeader } from "./report-to";
import { validateCspOptions } from "./validation";
import type {
  CompiledContentSecurityPolicy,
  ContentSecurityPolicyNonceOptions,
  ContentSecurityPolicyOptions,
  NormalizedContentSecurityPolicy,
  TrinacriaSecurityMode,
} from "./types";

export function compileContentSecurityPolicy(
  options: false | ContentSecurityPolicyOptions | undefined,
  mode: TrinacriaSecurityMode,
): CompiledContentSecurityPolicy | null {
  const normalized = normalizeContentSecurityPolicy(options, mode);
  if (!normalized) {
    return null;
  }

  const name = normalized.reportOnly
    ? "content-security-policy-report-only"
    : "content-security-policy";

  const entries = Object.entries(normalized.directives);
  const staticCacheKey = `${name}|${stableStringify(entries)}`;

  if (!normalized.nonceEnabled) {
    const value = getCachedCspValue(staticCacheKey, () => renderCsp(entries));

    return {
      name,
      reportToHeaderValue: normalized.reportToHeaderValue,
      build: () => ({ value }),
    };
  }

  return {
    name,
    reportToHeaderValue: normalized.reportToHeaderValue,
    build: () => {
      const nonce = normalized.nonceGenerator();
      const rendered: string[] = [];

      for (const [directive, sources] of entries) {
        let effectiveSources = sources;

        if (directive === "script-src" && normalized.nonceScript) {
          effectiveSources = addSourceToken(sources, `'nonce-${nonce}'`);
        } else if (directive === "style-src" && normalized.nonceStyle) {
          effectiveSources = addSourceToken(sources, `'nonce-${nonce}'`);
        }

        rendered.push(renderDirective(directive, effectiveSources));
      }

      return {
        value: rendered.join("; "),
        nonce,
        nonceStateKey: normalized.nonceStateKey,
      };
    },
  };
}

function normalizeContentSecurityPolicy(
  options: false | ContentSecurityPolicyOptions | undefined,
  mode: TrinacriaSecurityMode,
): NormalizedContentSecurityPolicy | null {
  if (options === false) {
    return null;
  }

  validateCspOptions(options);
  const nonceOptions = normalizeNonceOptions(options?.nonce);

  const directives = mergeCspDirectives(
    DEFAULT_CSP_DIRECTIVES,
    options?.directives ?? {},
    options?.overrideDirectives ?? false,
  );

  if (
    mode === "development" &&
    !Object.prototype.hasOwnProperty.call(
      options?.directives ?? {},
      "upgrade-insecure-requests",
    )
  ) {
    delete directives["upgrade-insecure-requests"];
  }

  if (options?.reportUri) {
    directives["report-uri"] = [options.reportUri];
  }

  if (options?.reportTo) {
    directives["report-to"] = [options.reportTo];
  }

  if (nonceOptions.enabled && options?.addStrictDynamicWhenNonce) {
    directives["script-src"] = addSourceToken(
      directives["script-src"] ?? ["'self'"],
      "'strict-dynamic'",
    );
  }

  if (!renderCsp(Object.entries(directives))) {
    return null;
  }

  return {
    directives,
    reportOnly: options?.reportOnly ?? false,
    nonceEnabled: nonceOptions.enabled,
    nonceScript: nonceOptions.script,
    nonceStyle: nonceOptions.style,
    nonceStateKey: nonceOptions.stateKey,
    nonceGenerator: nonceOptions.generator ?? defaultNonceGenerator,
    reportToHeaderValue: options?.reportToHeader
      ? buildReportToHeader(options.reportToHeader)
      : undefined,
  };
}

function mergeCspDirectives(
  defaults: Record<string, string[]>,
  custom: Record<string, string[]>,
  overrideDirectives: boolean,
): Record<string, string[]> {
  const merged: Record<string, string[]> = {};

  for (const [directive, sources] of Object.entries(defaults)) {
    merged[directive] = [...sources];
  }

  for (const [directive, customSources] of Object.entries(custom)) {
    if (overrideDirectives || !merged[directive]) {
      merged[directive] = [...customSources];
      continue;
    }

    merged[directive] = uniq([...merged[directive], ...customSources]);
  }

  return merged;
}

function normalizeNonceOptions(
  nonce: boolean | ContentSecurityPolicyNonceOptions | undefined,
): Required<Omit<ContentSecurityPolicyNonceOptions, "generator">> &
  Pick<ContentSecurityPolicyNonceOptions, "generator"> {
  if (!nonce) {
    return {
      enabled: false,
      script: false,
      style: false,
      stateKey: DEFAULT_NONCE_STATE_KEY,
      generator: undefined,
    };
  }

  if (nonce === true) {
    return {
      enabled: true,
      script: true,
      style: true,
      stateKey: DEFAULT_NONCE_STATE_KEY,
      generator: undefined,
    };
  }

  if (
    nonce.stateKey !== undefined &&
    (typeof nonce.stateKey !== "string" || nonce.stateKey.trim() === "")
  ) {
    throw new TypeError(
      "contentSecurityPolicy.nonce.stateKey must be a non-empty string",
    );
  }

  if (nonce.generator !== undefined && typeof nonce.generator !== "function") {
    throw new TypeError(
      "contentSecurityPolicy.nonce.generator must be a function",
    );
  }

  return {
    enabled: nonce.enabled ?? true,
    script: nonce.script ?? true,
    style: nonce.style ?? true,
    stateKey: nonce.stateKey ?? DEFAULT_NONCE_STATE_KEY,
    generator: nonce.generator,
  };
}

function defaultNonceGenerator(): string {
  return randomBytes(16).toString("base64url");
}
