import type { Schema } from "../core";

/**
 * Marks a schema as optional (`T | undefined`).
 */
export function optional<T>(schema: Schema<T>) {
  return schema.optional();
}

/**
 * Marks a schema as nullable (`T | null`).
 */
export function nullable<T>(schema: Schema<T>) {
  return schema.nullable();
}

/**
 * Sets a default value when input is `undefined`.
 */
export function defaultValue<T>(schema: Schema<T>, value: T) {
  return schema.default(value);
}
