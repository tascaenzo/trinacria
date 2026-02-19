import { asInternal, createSchema, type Schema } from "../core";
import { throwValidation } from "../errors";

export interface ArrayOptions<T> {
  /**
   * Minimum number of items.
   */
  minItems?: number;
  /**
   * Maximum number of items.
   */
  maxItems?: number;
  /**
   * Requires at least one item.
   */
  nonEmpty?: boolean;
  /**
   * Enforces unique items.
   * If a function is provided, uniqueness is checked on the selector result.
   */
  unique?: boolean | ((item: T) => unknown);
}

/**
 * Creates an array schema from an item schema.
 */
export function array<T>(itemSchema: Schema<T>, options: ArrayOptions<T> = {}) {
  if (
    options.minItems !== undefined &&
    (!Number.isInteger(options.minItems) || options.minItems < 0)
  ) {
    throw new Error("array(): minItems must be a non-negative integer");
  }

  if (
    options.maxItems !== undefined &&
    (!Number.isInteger(options.maxItems) || options.maxItems < 0)
  ) {
    throw new Error("array(): maxItems must be a non-negative integer");
  }

  if (
    options.minItems !== undefined &&
    options.maxItems !== undefined &&
    options.minItems > options.maxItems
  ) {
    throw new Error("array(): minItems cannot be greater than maxItems");
  }

  const internalItem = asInternal(itemSchema);
  const minItems = Math.max(options.nonEmpty ? 1 : 0, options.minItems ?? 0);

  return createSchema(
    "array",
    (input, path) => {
      if (!Array.isArray(input)) {
        throwValidation(path, "Expected array", "invalid_type");
      }

      if (input.length < minItems) {
        throwValidation(
          path,
          `Array must contain at least ${minItems} items`,
          "too_small",
        );
      }

      if (options.maxItems !== undefined && input.length > options.maxItems) {
        throwValidation(
          path,
          `Array must contain at most ${options.maxItems} items`,
          "too_big",
        );
      }

      const parsed = input.map((value, index) =>
        internalItem.parseAtPath(value, [...path, index]),
      );

      if (options.unique) {
        const selector =
          typeof options.unique === "function"
            ? options.unique
            : (value: T) => value;
        const seen = new Set<unknown>();

        for (const [index, item] of parsed.entries()) {
          const key = selector(item);
          if (seen.has(key)) {
            throwValidation(
              [...path, index],
              "Array items must be unique",
              "not_unique",
            );
          }
          seen.add(key);
        }
      }

      return parsed;
    },
    () => {
      const openApi: Record<string, unknown> = {
        type: "array",
        items: itemSchema.toOpenApi(),
      };

      if (minItems > 0) {
        openApi.minItems = minItems;
      }

      if (options.maxItems !== undefined) {
        openApi.maxItems = options.maxItems;
      }

      if (options.unique) {
        openApi.uniqueItems = true;
      }

      return openApi;
    },
  );
}
