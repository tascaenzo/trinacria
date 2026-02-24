import { asInternal, createSchema, type Infer, type Schema } from "../core";
import { throwValidation } from "../errors";

type InferTuple<T extends readonly Schema<unknown>[]> = {
  [K in keyof T]: T[K] extends Schema<unknown> ? Infer<T[K]> : never;
};

/**
 * Creates a fixed-length tuple schema.
 */
export function tuple<T extends readonly Schema<unknown>[]>(schemas: T) {
  if (schemas.length === 0) {
    throw new Error("tuple(): at least one schema is required");
  }

  const internalSchemas = schemas.map(asInternal);

  return createSchema<InferTuple<T>>(
    "tuple",
    (input, path) => {
      if (!Array.isArray(input)) {
        throwValidation(path, "Expected array", "invalid_type");
      }

      if (input.length !== internalSchemas.length) {
        throwValidation(
          path,
          `Tuple must contain exactly ${internalSchemas.length} items`,
          "invalid_tuple_length",
        );
      }

      const result = internalSchemas.map((schema, index) =>
        schema.parseAtPath(input[index], [...path, index]),
      );

      return result as InferTuple<T>;
    },
    () => ({
      type: "array",
      prefixItems: schemas.map((schema) => schema.toOpenApi()),
      minItems: schemas.length,
      maxItems: schemas.length,
    }),
  );
}
