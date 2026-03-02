import { asInternal, createSchema, type ParseOptions, type Schema } from "../core";
import {
  ValidationError,
  throwValidation,
  validationIssue,
  type ValidationIssue,
} from "../errors";

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
  /**
   * Coerces a string input into an array by splitting on a separator.
   * Useful for env vars like "a,b,c".
   */
  coerce?: boolean | { separator?: string };
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
  const coerceSeparator =
    typeof options.coerce === "object" && options.coerce.separator
      ? options.coerce.separator
      : ",";

  return createSchema(
    "array",
    (input, path, parseOptions: ParseOptions = {}) => {
      const normalizedInput =
        options.coerce && typeof input === "string"
          ? input
              .split(coerceSeparator)
              .map((value) => value.trim())
              .filter(Boolean)
          : input;

      if (!Array.isArray(normalizedInput)) {
        throwValidation(path, "Expected array", "invalid_type");
      }

      const isCollectAll = parseOptions.mode === "all";
      const issues: ValidationIssue[] | null = isCollectAll ? [] : null;

      if (normalizedInput.length < minItems) {
        if (isCollectAll) {
          issues?.push(
            validationIssue(
              path,
              `Array must contain at least ${minItems} items`,
              "too_small",
            ),
          );
        } else {
          throwValidation(
            path,
            `Array must contain at least ${minItems} items`,
            "too_small",
          );
        }
      }

      if (
        options.maxItems !== undefined &&
        normalizedInput.length > options.maxItems
      ) {
        if (isCollectAll) {
          issues?.push(
            validationIssue(
              path,
              `Array must contain at most ${options.maxItems} items`,
              "too_big",
            ),
          );
        } else {
          throwValidation(
            path,
            `Array must contain at most ${options.maxItems} items`,
            "too_big",
          );
        }
      }

      const parsed: T[] = [];
      for (const [index, value] of normalizedInput.entries()) {
        try {
          parsed.push(internalItem.parseAtPath(value, [...path, index], parseOptions));
        } catch (error) {
          if (isCollectAll && error instanceof ValidationError) {
            issues?.push(...error.issues);
            continue;
          }
          throw error;
        }
      }

      if (options.unique) {
        const selector =
          typeof options.unique === "function"
            ? options.unique
            : (value: T) => value;
        const seen = new Set<unknown>();

        for (const [index, item] of parsed.entries()) {
          const key = selector(item);
          if (seen.has(key)) {
            if (isCollectAll) {
              issues?.push(
                validationIssue(
                  [...path, index],
                  "Array items must be unique",
                  "not_unique",
                ),
              );
              continue;
            }
            throwValidation(
              [...path, index],
              "Array items must be unique",
              "not_unique",
            );
          }
          seen.add(key);
        }
      }

      if (issues && issues.length > 0) {
        throw new ValidationError(issues);
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
