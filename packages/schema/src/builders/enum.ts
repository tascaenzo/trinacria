import { createSchema } from "../core";
import { throwValidation } from "../errors";

/**
 * Creates a string enum schema from a readonly tuple.
 */
export function enumSchema<const T extends readonly string[]>(values: T) {
  const allowed = new Set(values as readonly string[]);

  return createSchema(
    "enum",
    (input, path) => {
      if (typeof input !== "string" || !allowed.has(input)) {
        throwValidation(
          path,
          "Expected one of the allowed enum values",
          "invalid_enum",
        );
      }

      return input as T[number];
    },
    () => ({ type: "string", enum: [...values] }),
  );
}
