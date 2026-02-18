import {
  asInternal,
  createSchema,
  isRecord,
  type Infer,
  type Schema,
} from "../core";
import { throwValidation } from "../errors";

export interface ObjectOptions {
  /**
   * Rejects unknown keys when `true`.
   */
  strict?: boolean;
  /**
   * Requires at least N parsed properties.
   */
  minProperties?: number;
}

type Shape = Record<string, Schema<unknown>>;
export type SchemaShape<T extends object> = {
  [K in keyof T]-?: Schema<T[K]>;
};

type OptionalKeys<T extends Shape> = {
  [K in keyof T]-?: undefined extends Infer<T[K]> ? K : never;
}[keyof T];

type RequiredKeys<T extends Shape> = Exclude<keyof T, OptionalKeys<T>>;

type InferShape<T extends Shape> = {
  [K in RequiredKeys<T>]: Infer<T[K]>;
} & {
  [K in OptionalKeys<T>]?: Exclude<Infer<T[K]>, undefined>;
};

/**
 * Creates an object schema from a shape definition.
 */
export function object<T extends Shape>(shape: T, options: ObjectOptions = {}) {
  const internalShape = Object.fromEntries(
    Object.entries(shape).map(([key, schema]) => [key, asInternal(schema)]),
  ) as Record<string, ReturnType<typeof asInternal>>;

  const strict = options.strict ?? false;
  const minProperties = options.minProperties;

  return createSchema<InferShape<T>>(
    "object",
    (input, path) => {
      if (!isRecord(input)) {
        throwValidation(path, "Expected object", "invalid_type");
      }

      const result: Record<string, unknown> = {};

      for (const [key, schema] of Object.entries(internalShape)) {
        const hasKey = key in input;

        if (!hasKey && !schema.acceptsUndefined) {
          throwValidation([...path, key], "Required field", "required");
        }

        const value = hasKey ? input[key] : undefined;
        const parsedValue = schema.parseAtPath(value, [...path, key]);

        if (hasKey || parsedValue !== undefined) {
          result[key] = parsedValue;
        }
      }

      if (strict) {
        for (const key of Object.keys(input)) {
          if (!(key in internalShape)) {
            throwValidation([...path, key], "Unknown field", "unknown_key");
          }
        }
      }

      if (
        minProperties !== undefined &&
        Object.keys(result).length < minProperties
      ) {
        throwValidation(
          path,
          `Object must have at least ${minProperties} properties`,
          "too_small",
        );
      }

      return result as InferShape<T>;
    },
    () => {
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, schema] of Object.entries(internalShape)) {
        properties[key] = schema.toOpenApi();
        if (!schema.acceptsUndefined) {
          required.push(key);
        }
      }

      const openApi: Record<string, unknown> = {
        type: "object",
        properties,
      };

      if (required.length > 0) {
        openApi.required = required;
      }

      if (strict) {
        openApi.additionalProperties = false;
      }

      if (minProperties !== undefined) {
        openApi.minProperties = minProperties;
      }

      return openApi;
    },
  );
}

/**
 * Model-first object builder using a target interface/type.
 */
export function objectOf<T extends object>() {
  return (shape: SchemaShape<T>, options?: ObjectOptions) =>
    object(shape, options) as unknown as Schema<T>;
}
