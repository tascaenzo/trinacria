/**
 * A position inside a nested payload (object keys / array indexes).
 */
export type Path = Array<string | number>;

/**
 * One validation problem found while parsing input data.
 */
export interface ValidationIssue {
  path: Path;
  message: string;
  code: string;
}

export interface FormatValidationErrorOptions {
  prefix?: string;
  rootLabel?: string;
  bullet?: string;
}

/**
 * Error thrown when schema parsing fails.
 */
export class ValidationError extends Error {
  constructor(public readonly issues: ValidationIssue[]) {
    super("Schema validation failed");
    this.name = "ValidationError";
  }
}

/**
 * Creates a single validation issue object.
 */
export function validationIssue(
  path: Path,
  message: string,
  code: string,
): ValidationIssue {
  return { path, message, code };
}

/**
 * Throws a `ValidationError` with one issue.
 */
export function throwValidation(
  path: Path,
  message: string,
  code: string,
): never {
  throw new ValidationError([validationIssue(path, message, code)]);
}

/**
 * Formats a validation error into a readable multi-line message.
 */
export function formatValidationError(
  error: ValidationError,
  options: FormatValidationErrorOptions = {},
): string {
  const {
    prefix = "Validation failed:",
    rootLabel = "root",
    bullet = "-",
  } = options;

  const details = error.issues.map((issue) => {
    const key =
      issue.path.length > 0 ? issue.path.map(String).join(".") : rootLabel;
    return `${bullet} ${key}: ${issue.message}`;
  });

  return [prefix, ...details].join("\n");
}
