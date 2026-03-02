import {
  asInternal,
  createSchema,
  isRecord,
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

const FORBIDDEN_OBJECT_KEYS = new Set([
  "__proto__",
  "prototype",
  "constructor",
]);

/**
 * Creates a record schema where object keys and values are both validated.
 */
export function record<K extends string, V>(
  keySchema: Schema<K>,
  valueSchema: Schema<V>,
) {
  const internalKey = asInternal(keySchema);
  const internalValue = asInternal(valueSchema);

  return createSchema<Record<K, V>>(
    "record",
    (input, path, parseOptions: ParseOptions = {}) => {
      if (!isRecord(input)) {
        throwValidation(path, "Expected object", "invalid_type");
      }

      const result = Object.create(null) as Record<string, V>;
      const isCollectAll = parseOptions.mode === "all";
      const issues: ValidationIssue[] | null = isCollectAll ? [] : null;

      for (const [rawKey, rawValue] of Object.entries(input)) {
        if (FORBIDDEN_OBJECT_KEYS.has(rawKey)) {
          if (isCollectAll) {
            issues?.push(
              validationIssue(
                [...path, rawKey],
                `Forbidden object key "${rawKey}"`,
                "forbidden_key",
              ),
            );
            continue;
          }
          throwValidation(
            [...path, rawKey],
            `Forbidden object key "${rawKey}"`,
            "forbidden_key",
          );
        }

        let parsedKey: K;
        let parsedValue: V;
        try {
          parsedKey = internalKey.parseAtPath(rawKey, [...path, rawKey], parseOptions);
          parsedValue = internalValue.parseAtPath(rawValue, [...path, rawKey], parseOptions);
        } catch (error) {
          if (isCollectAll && error instanceof ValidationError) {
            issues?.push(...error.issues);
            continue;
          }
          throw error;
        }

        if (Object.hasOwn(result, parsedKey)) {
          if (isCollectAll) {
            issues?.push(
              validationIssue(
                [...path, rawKey],
                `Duplicate key "${parsedKey}" after normalization`,
                "duplicate_key",
              ),
            );
            continue;
          }
          throwValidation(
            [...path, rawKey],
            `Duplicate key "${parsedKey}" after normalization`,
            "duplicate_key",
          );
        }

        result[parsedKey] = parsedValue;
      }

      if (issues && issues.length > 0) {
        throw new ValidationError(issues);
      }

      return result as Record<K, V>;
    },
    () => ({
      type: "object",
      propertyNames: keySchema.toOpenApi(),
      additionalProperties: valueSchema.toOpenApi(),
    }),
  );
}

export type InferRecord<
  K extends Schema<string>,
  V extends Schema<unknown>,
> = Record<Infer<K>, Infer<V>>;
