import type { OpenApiDocument } from "@trinacria/http";

/**
 * Adds security scheme definitions shared by route docs.
 * Route-level docs still decide which scheme is required.
 */
export function withSecuritySchemes(
  document: OpenApiDocument,
): OpenApiDocument {
  const components = (document.components ?? {}) as Record<string, unknown>;
  const existingSecuritySchemes = (components.securitySchemes ?? {}) as Record<
    string,
    unknown
  >;

  return {
    ...document,
    components: {
      ...components,
      securitySchemes: {
        ...existingSecuritySchemes,
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        accessTokenCookie: {
          type: "apiKey",
          in: "cookie",
          name: "trinacria_access_token",
        },
        csrfHeader: {
          type: "apiKey",
          in: "header",
          name: "x-csrf-token",
        },
      },
    },
  };
}
