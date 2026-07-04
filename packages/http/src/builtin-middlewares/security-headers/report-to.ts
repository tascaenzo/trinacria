import type { ReportToHeaderOptions } from "./types";
import { assertNoCrlf } from "./validation";

export function buildReportToHeader(options: ReportToHeaderOptions): string {
  if (!Number.isFinite(options.maxAge) || options.maxAge < 0) {
    throw new RangeError(
      "contentSecurityPolicy.reportToHeader.maxAge must be >= 0",
    );
  }

  if (!Array.isArray(options.endpoints) || options.endpoints.length === 0) {
    throw new TypeError(
      "contentSecurityPolicy.reportToHeader.endpoints must contain at least one endpoint",
    );
  }

  const endpoints = options.endpoints.map((endpoint) => {
    if (
      !endpoint ||
      typeof endpoint.url !== "string" ||
      endpoint.url.trim() === ""
    ) {
      throw new TypeError(
        "contentSecurityPolicy.reportToHeader.endpoints[].url must be a non-empty string",
      );
    }

    assertNoCrlf(
      endpoint.url,
      "contentSecurityPolicy.reportToHeader.endpoints[].url",
    );
    return { url: endpoint.url };
  });

  return JSON.stringify({
    group: options.group ?? "csp-endpoint",
    max_age: Math.floor(options.maxAge),
    endpoints,
    include_subdomains: options.includeSubDomains ?? false,
  });
}
