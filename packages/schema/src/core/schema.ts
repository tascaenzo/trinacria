import { ValidationError, type Path, validationIssue } from "../errors";
import type { OpenApiSchemaObject } from "../openapi";

/**
 * Successful result of `safeParse`.
 */
export interface ParseOk<T> {
  success: true;
  data: T;
}

/**
 * Failed result of `safeParse`.
 */
export interface ParseFail {
  success: false;
  error: ValidationError;
}

export type ParseResult<T> = ParseOk<T> | ParseFail;

/**
 * Public schema contract.
 *
 * A schema can parse/validate unknown input, expose an inferred TS type,
 * and export an OpenAPI representation.
 */
export interface Schema<T> {
  readonly _type: T;
  readonly kind: string;
  parse(input: unknown): T;
  safeParse(input: unknown): ParseResult<T>;
  toOpenApi(): OpenApiSchemaObject;
  optional(): Schema<T | undefined>;
  nullable(): Schema<T | null>;
  default(value: T): Schema<T>;
}

/**
 * Extracts the TypeScript output type from a schema instance.
 */
export type Infer<T extends Schema<unknown>> = T["_type"];

/**
 * Internal schema contract used by composite builders (`object`, `array`, `union`).
 */
export interface InternalSchema<T> extends Schema<T> {
  readonly acceptsUndefined: boolean;
  parseAtPath(input: unknown, path: Path): T;
}

interface CreateSchemaOptions {
  acceptsUndefined?: boolean;
}

/**
 * Creates an immutable schema object from parse/openapi callbacks.
 */
export function createSchema<T>(
  kind: string,
  parseAtPath: (input: unknown, path: Path) => T,
  toOpenApi: () => OpenApiSchemaObject,
  options: CreateSchemaOptions = {},
): InternalSchema<T> {
  const schema: InternalSchema<T> = {
    _type: undefined as T,
    kind,
    acceptsUndefined: options.acceptsUndefined ?? false,
    parse(input: unknown): T {
      return parseAtPath(input, []);
    },
    safeParse(input: unknown): ParseResult<T> {
      try {
        return { success: true, data: parseAtPath(input, []) };
      } catch (error) {
        if (error instanceof ValidationError) {
          return { success: false, error };
        }

        return {
          success: false,
          error: new ValidationError([
            validationIssue(
              [],
              "Unexpected schema parser failure",
              "internal_error",
            ),
          ]),
        };
      }
    },
    parseAtPath,
    toOpenApi,
    optional(): Schema<T | undefined> {
      return createSchema<T | undefined>(
        "optional",
        (input, path) => {
          if (input === undefined) {
            return undefined;
          }

          return parseAtPath(input, path);
        },
        () => toOpenApi(),
        { acceptsUndefined: true },
      );
    },
    nullable(): Schema<T | null> {
      return createSchema<T | null>(
        "nullable",
        (input, path) => {
          if (input === null) {
            return null;
          }

          return parseAtPath(input, path);
        },
        () => ({
          anyOf: [toOpenApi(), { type: "null" }],
        }),
      );
    },
    default(value: T): Schema<T> {
      return createSchema<T>(
        "default",
        (input, path) => {
          if (input === undefined) {
            return value;
          }

          return parseAtPath(input, path);
        },
        () => ({
          ...toOpenApi(),
          default: value,
        }),
        { acceptsUndefined: true },
      );
    },
  };

  return Object.freeze(schema);
}
