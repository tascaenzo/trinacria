import {
  asInternal,
  createSchema,
  type Infer,
  type ParseOptions,
  type Schema,
} from "../core";
import {
  ValidationError,
  throwValidation,
  validationIssue,
  type ValidationIssue,
} from "../errors";

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
    (input, path, parseOptions: ParseOptions = {}) => {
      if (!Array.isArray(input)) {
        throwValidation(path, "Expected array", "invalid_type");
      }

      const isCollectAll = parseOptions.mode === "all";
      const issues: ValidationIssue[] | null = isCollectAll ? [] : null;

      if (input.length !== internalSchemas.length) {
        if (isCollectAll) {
          issues?.push(
            validationIssue(
              path,
              `Tuple must contain exactly ${internalSchemas.length} items`,
              "invalid_tuple_length",
            ),
          );
        } else {
          throwValidation(
            path,
            `Tuple must contain exactly ${internalSchemas.length} items`,
            "invalid_tuple_length",
          );
        }
      }

      const result: unknown[] = [];
      for (const [index, schema] of internalSchemas.entries()) {
        try {
          result.push(schema.parseAtPath(input[index], [...path, index], parseOptions));
        } catch (error) {
          if (isCollectAll && error instanceof ValidationError) {
            issues?.push(...error.issues);
            continue;
          }
          throw error;
        }
      }

      if (issues && issues.length > 0) {
        throw new ValidationError(issues);
      }

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
