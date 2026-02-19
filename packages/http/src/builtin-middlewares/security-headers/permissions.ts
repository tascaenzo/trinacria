import { KNOWN_PERMISSIONS_POLICY_FEATURES } from "./constants";
import { assertNoCrlf } from "./validation";
import type {
  PermissionsPolicyValue,
  TrinacriaSecurityMode,
  ValidationMode,
} from "./types";

export function buildPermissionsPolicyHeader(
  value: PermissionsPolicyValue,
  validationMode: ValidationMode,
  mode: TrinacriaSecurityMode,
): string | false {
  if (value === false || typeof value === "string") {
    if (typeof value === "string") {
      assertNoCrlf(value, "permissionsPolicy");
    }
    return value;
  }

  const entries = Object.entries(value).map(([feature, allowlist]) => {
    validatePermissionsPolicyFeature(feature, validationMode, mode);

    if (!Array.isArray(allowlist)) {
      throw new TypeError(
        `Invalid permissionsPolicy value for "${feature}": expected string[]`,
      );
    }

    for (const source of allowlist) {
      if (typeof source !== "string") {
        throw new TypeError(
          `Invalid permissionsPolicy allowlist item for "${feature}": expected string`,
        );
      }
      assertNoCrlf(source, `permissionsPolicy.${feature}`);
    }

    return `${feature}=(${allowlist.join(" ")})`;
  });

  return entries.join(", ");
}

function validatePermissionsPolicyFeature(
  feature: string,
  validationMode: ValidationMode,
  mode: TrinacriaSecurityMode,
): void {
  if (KNOWN_PERMISSIONS_POLICY_FEATURES.has(feature)) {
    return;
  }

  if (validationMode === "strict") {
    throw new TypeError(
      `Unknown permissions-policy feature "${feature}". Set permissionsPolicyValidation to "off" or "warn" to allow it.`,
    );
  }

  if (validationMode === "warn" && mode !== "production") {
    console.warn(
      `[securityHeaders] Unknown permissions-policy feature "${feature}"`,
    );
  }
}
