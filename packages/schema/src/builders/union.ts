import { asInternal, createSchema, type Infer, type Schema } from "../core";
import {
  ValidationError,
  validationIssue,
  type ValidationIssue,
} from "../errors";

export interface UnionOptions {
  /**
   * Maximum number of issues to keep when all branches fail.
   */
  maxIssues?: number;
}

/**
 * Creates a union schema (`oneOf` in OpenAPI).
 */
export function union<T extends readonly Schema<unknown>[]>(
  schemas: T,
  options: UnionOptions = {},
) {
  if (schemas.length === 0) {
    throw new Error("union(): at least one schema is required");
  }

  const maxIssues = options.maxIssues ?? 20;
  if (!Number.isInteger(maxIssues) || maxIssues <= 0) {
    throw new Error("union(): maxIssues must be a positive integer");
  }

  const internalSchemas = schemas.map(asInternal);

  return createSchema<Infer<T[number]>>(
    "union",
    (input, path) => {
      const nestedIssues: ValidationIssue[] = [];
      let truncated = false;

      for (const schema of internalSchemas) {
        try {
          return schema.parseAtPath(input, path) as Infer<T[number]>;
        } catch (error) {
          if (error instanceof ValidationError) {
            const remaining: number = maxIssues - nestedIssues.length;
            if (remaining <= 0) {
              truncated = true;
              break;
            }

            if (error.issues.length > remaining) {
              truncated = true;
            }

            nestedIssues.push(...error.issues.slice(0, remaining));

            if (nestedIssues.length >= maxIssues) {
              break;
            }
            continue;
          }
          throw error;
        }
      }

      if (nestedIssues.length > 0) {
        if (truncated) {
          nestedIssues.push(
            validationIssue(
              path,
              `Validation issues truncated to ${maxIssues} entries`,
              "issues_truncated",
            ),
          );
        }
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
