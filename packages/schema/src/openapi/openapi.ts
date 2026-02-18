import type { Schema } from "../core";

export type OpenApiSchemaObject = Record<string, unknown>;

/**
 * Converts any schema instance to its OpenAPI schema object.
 */
export function toOpenApi(schema: Schema<unknown>): OpenApiSchemaObject {
  return schema.toOpenApi();
}
