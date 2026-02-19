import type {
  ContentSecurityPolicyOptions,
  ContentSecurityPolicyValue,
  PermissionsPolicyValue,
  SecurityHeadersOptions,
  StrictTransportSecurityOptions,
  StrictTransportSecurityValue,
} from "./types";

export function cloneSecurityHeadersOptions(
  options: SecurityHeadersOptions,
): SecurityHeadersOptions {
  return {
    ...options,
    headers: options.headers ? { ...options.headers } : undefined,
    contentSecurityPolicy: cloneContentSecurityPolicy(
      options.contentSecurityPolicy,
    ),
    strictTransportSecurity: isStrictTransportSecurityOptions(
      options.strictTransportSecurity,
    )
      ? { ...options.strictTransportSecurity }
      : options.strictTransportSecurity,
    permissionsPolicy: clonePermissionsPolicy(options.permissionsPolicy),
  };
}

export function mergeSecurityHeadersOptions(
  base: SecurityHeadersOptions,
  patch: SecurityHeadersOptions,
): SecurityHeadersOptions {
  const merged: SecurityHeadersOptions = cloneSecurityHeadersOptions(base);

  if (patch.mode !== undefined) merged.mode = patch.mode;
  if (patch.trustProxy !== undefined) merged.trustProxy = patch.trustProxy;
  if (patch.permissionsPolicyValidation !== undefined) {
    merged.permissionsPolicyValidation = patch.permissionsPolicyValidation;
  }
  if (patch.crossOriginEmbedderPolicy !== undefined) {
    merged.crossOriginEmbedderPolicy = patch.crossOriginEmbedderPolicy;
  }
  if (patch.permissionsPolicy !== undefined) {
    merged.permissionsPolicy = clonePermissionsPolicy(patch.permissionsPolicy);
  }

  if (patch.headers !== undefined) {
    merged.headers = { ...(merged.headers ?? {}), ...patch.headers };
  }

  if (patch.strictTransportSecurity !== undefined) {
    if (patch.strictTransportSecurity === false) {
      merged.strictTransportSecurity = false;
    } else {
      const current = isStrictTransportSecurityOptions(
        merged.strictTransportSecurity,
      )
        ? merged.strictTransportSecurity
        : {};
      merged.strictTransportSecurity = {
        ...current,
        ...patch.strictTransportSecurity,
      };
    }
  }

  if (patch.contentSecurityPolicy !== undefined) {
    merged.contentSecurityPolicy = mergeContentSecurityPolicy(
      merged.contentSecurityPolicy,
      patch.contentSecurityPolicy,
    );
  }

  return merged;
}

function mergeContentSecurityPolicy(
  current: ContentSecurityPolicyValue | undefined,
  patch: ContentSecurityPolicyValue,
): ContentSecurityPolicyValue {
  if (patch === false) {
    return false;
  }

  const base = isContentSecurityPolicyOptions(current) ? current : {};
  const mergedDirectives = {
    ...(base.directives ?? {}),
    ...(patch.directives ?? {}),
  };

  return {
    ...base,
    ...patch,
    directives:
      Object.keys(mergedDirectives).length > 0 ? mergedDirectives : undefined,
    reportToHeader: patch.reportToHeader
      ? {
          ...patch.reportToHeader,
          endpoints: patch.reportToHeader.endpoints.map((endpoint) => ({
            ...endpoint,
          })),
        }
      : base.reportToHeader
        ? {
            ...base.reportToHeader,
            endpoints: base.reportToHeader.endpoints.map((endpoint) => ({
              ...endpoint,
            })),
          }
        : undefined,
    nonce: patch.nonce ?? base.nonce,
  };
}

function cloneContentSecurityPolicy(
  value: ContentSecurityPolicyValue | undefined,
): ContentSecurityPolicyValue | undefined {
  if (value === false || value === undefined) {
    return value;
  }

  return {
    ...value,
    directives: value.directives
      ? Object.fromEntries(
          Object.entries(value.directives).map(([key, directives]) => [
            key,
            [...directives],
          ]),
        )
      : undefined,
    reportToHeader: value.reportToHeader
      ? {
          ...value.reportToHeader,
          endpoints: value.reportToHeader.endpoints.map((endpoint) => ({
            ...endpoint,
          })),
        }
      : undefined,
    nonce:
      value.nonce && value.nonce !== true ? { ...value.nonce } : value.nonce,
  };
}

function clonePermissionsPolicy(
  value: PermissionsPolicyValue | undefined,
): PermissionsPolicyValue | undefined {
  if (value === undefined || value === false || typeof value === "string") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([feature, allowlist]) => [
      feature,
      [...allowlist],
    ]),
  );
}

function isStrictTransportSecurityOptions(
  value: StrictTransportSecurityValue | undefined,
): value is StrictTransportSecurityOptions {
  return value !== undefined && value !== false;
}

function isContentSecurityPolicyOptions(
  value: ContentSecurityPolicyValue | undefined,
): value is ContentSecurityPolicyOptions {
  return value !== undefined && value !== false;
}
