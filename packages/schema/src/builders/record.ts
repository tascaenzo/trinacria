import { asInternal, createSchema, isRecord, type Infer, type Schema } from "../core";
import { throwValidation } from "../errors";

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
    (input, path) => {
      if (!isRecord(input)) {
        throwValidation(path, "Expected object", "invalid_type");
      }

      const result = Object.create(null) as Record<string, V>;

      for (const [rawKey, rawValue] of Object.entries(input)) {
        if (FORBIDDEN_OBJECT_KEYS.has(rawKey)) {
          throwValidation(
            [...path, rawKey],
            `Forbidden object key "${rawKey}"`,
            "forbidden_key",
          );
        }

        const parsedKey = internalKey.parseAtPath(rawKey, [...path, rawKey]);
        const parsedValue = internalValue.parseAtPath(rawValue, [...path, rawKey]);

        if (Object.hasOwn(result, parsedKey)) {
          throwValidation(
            [...path, rawKey],
            `Duplicate key "${parsedKey}" after normalization`,
            "duplicate_key",
          );
        }

        result[parsedKey] = parsedValue;
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

export type InferRecord<K extends Schema<string>, V extends Schema<unknown>> = Record<
  Infer<K>,
  Infer<V>
>;
