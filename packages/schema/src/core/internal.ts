import type { InternalSchema, Schema } from "./schema";

/**
 * Casts a public schema to its internal runtime shape.
 */
export function asInternal<T>(schema: Schema<T>): InternalSchema<T> {
  return schema as InternalSchema<T>;
}

/**
 * Checks whether a value is a plain object record.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
