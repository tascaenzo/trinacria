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
