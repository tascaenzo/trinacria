import { asInternal, createSchema, type Infer, type Schema } from "../core";
import { ValidationError, validationIssue } from "../errors";

/**
 * Creates a union schema (`oneOf` in OpenAPI).
 */
export function union<T extends readonly Schema<unknown>[]>(schemas: T) {
  const internalSchemas = schemas.map(asInternal);

  return createSchema<Infer<T[number]>>(
    "union",
    (input, path) => {
      const nestedIssues = [];

      for (const schema of internalSchemas) {
        try {
          return schema.parseAtPath(input, path) as Infer<T[number]>;
        } catch (error) {
          if (error instanceof ValidationError) {
            nestedIssues.push(...error.issues);
            continue;
          }
          throw error;
        }
      }

      if (nestedIssues.length > 0) {
        throw new ValidationError(nestedIssues);
      }

      throw new ValidationError([
        validationIssue(
          path,
          "Input does not match any union branch",
          "invalid_union",
        ),
      ]);
    },
    () => ({
      oneOf: schemas.map((schema) => schema.toOpenApi()),
    }),
  );
}
