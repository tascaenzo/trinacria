import { type Path, ValidationError, validationIssue } from "../errors";
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
export type ParseMode = "first" | "all";

export interface ParseOptions {
  mode?: ParseMode;
}

export interface RefineIssue {
  path?: Path;
  message: string;
  code?: string;
}

export interface SuperRefineContext {
  addIssue(issue: RefineIssue): void;
}

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
  safeParse(input: unknown, options?: ParseOptions): ParseResult<T>;
  toOpenApi(): OpenApiSchemaObject;
  optional(): Schema<T | undefined>;
  nullable(): Schema<T | null>;
  default(value: T): Schema<T>;
  refine(
    check: (value: T) => boolean,
    message?: string,
    code?: string,
  ): Schema<T>;
  superRefine(check: (value: T, ctx: SuperRefineContext) => void): Schema<T>;
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
  parseAtPath(input: unknown, path: Path, options?: ParseOptions): T;
}

interface CreateSchemaOptions {
  acceptsUndefined?: boolean;
}

/**
 * Creates an immutable schema object from parse/openapi callbacks.
 */
export function createSchema<T>(
  kind: string,
  parseAtPath: (input: unknown, path: Path, options?: ParseOptions) => T,
  toOpenApi: () => OpenApiSchemaObject,
  options: CreateSchemaOptions = {},
): InternalSchema<T> {
  const schema: InternalSchema<T> = {
    _type: undefined as T,
    kind,
    acceptsUndefined: options.acceptsUndefined ?? false,
    parse(input: unknown): T {
      return parseAtPath(input, [], { mode: "first" });
    },
    safeParse(input: unknown, parseOptions: ParseOptions = {}): ParseResult<T> {
      try {
        return { success: true, data: parseAtPath(input, [], parseOptions) };
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
        (input, path, parseOptions) => {
          if (input === undefined) {
            return undefined;
          }

          return parseAtPath(input, path, parseOptions);
        },
        () => toOpenApi(),
        { acceptsUndefined: true },
      );
    },
    nullable(): Schema<T | null> {
      return createSchema<T | null>(
        "nullable",
        (input, path, parseOptions) => {
          if (input === null) {
            return null;
          }

          return parseAtPath(input, path, parseOptions);
        },
        () => ({
          anyOf: [toOpenApi(), { type: "null" }],
        }),
      );
    },
    default(value: T): Schema<T> {
      return createSchema<T>(
        "default",
        (input, path, parseOptions) => {
          if (input === undefined) {
            return value;
          }

          return parseAtPath(input, path, parseOptions);
        },
        () => ({
          ...toOpenApi(),
          default: value,
        }),
        { acceptsUndefined: true },
      );
    },
    refine(
      check: (value: T) => boolean,
      message = "Refinement failed",
      code = "invalid_refinement",
    ): Schema<T> {
      return createSchema<T>(
        "refine",
        (input, path, parseOptions) => {
          const parsed = parseAtPath(input, path, parseOptions);
          if (!check(parsed)) {
            throw new ValidationError([validationIssue(path, message, code)]);
          }

          return parsed;
        },
        () => toOpenApi(),
        { acceptsUndefined: options.acceptsUndefined ?? false },
      );
    },
    superRefine(check: (value: T, ctx: SuperRefineContext) => void): Schema<T> {
      return createSchema<T>(
        "super_refine",
        (input, path, parseOptions) => {
          const parsed = parseAtPath(input, path, parseOptions);
          const issues: ReturnType<typeof validationIssue>[] = [];
          const ctx: SuperRefineContext = {
            addIssue: (issue) => {
              const issuePath =
                issue.path === undefined ? path : [...path, ...issue.path];
              issues.push(
                validationIssue(
                  issuePath,
                  issue.message,
                  issue.code ?? "invalid_refinement",
                ),
              );
            },
          };

          check(parsed, ctx);

          if (issues.length > 0) {
            throw new ValidationError(issues);
          }

          return parsed;
        },
        () => toOpenApi(),
        { acceptsUndefined: options.acceptsUndefined ?? false },
      );
    },
  };

  return Object.freeze(schema);
}
