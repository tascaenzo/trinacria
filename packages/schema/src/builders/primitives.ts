import { createSchema } from "../core";
import { throwValidation } from "../errors";

export interface NumberOptions {
  /**
   * Converts numeric strings (e.g. `"42"`) into numbers before validation.
   */
  coerce?: boolean;
  /**
   * Requires an integer value.
   */
  int?: boolean;
  /**
   * Inclusive minimum value.
   */
  min?: number;
  /**
   * Inclusive maximum value.
   */
  max?: number;
  /**
   * Requires value > 0.
   */
  positive?: boolean;
  /**
   * Requires value < 0.
   */
  negative?: boolean;
  /**
   * Requires value to be a multiple of N.
   */
  multipleOf?: number;
}

export interface StringOptions {
  /**
   * Trims leading and trailing whitespace.
   */
  trim?: boolean;
  /**
   * Converts the parsed value to lowercase.
   */
  toLowerCase?: boolean;
  /**
   * Converts the parsed value to uppercase.
   */
  toUpperCase?: boolean;
  /**
   * Minimum accepted length.
   */
  minLength?: number;
  /**
   * Maximum accepted length.
   */
  maxLength?: number;
  /**
   * Enables simple email format validation.
   */
  email?: boolean;
  /**
   * Enables URL validation using WHATWG URL parser.
   */
  url?: boolean;
  /**
   * Restricts allowed URL protocols (e.g. `["http:", "https:"]`).
   */
  urlProtocols?: readonly string[];
  /**
   * Enables UUID validation. Use "3" | "4" | "5" | "all".
   */
  uuid?: "3" | "4" | "5" | "all" | true;
  /**
   * Requires the string to start with this value.
   */
  startsWith?: string;
  /**
   * Requires the string to end with this value.
   */
  endsWith?: string;
  /**
   * Requires the string to include this value.
   */
  includes?: string;
  /**
   * Requires the string to match this regular expression.
   */
  pattern?: RegExp;
  /**
   * Requires only letters A-Z (case-insensitive).
   */
  alpha?: boolean;
  /**
   * Requires only letters and numbers.
   */
  alphanumeric?: boolean;
  /**
   * Requires only ASCII characters.
   */
  ascii?: boolean;
  /**
   * Requires the final value to be lowercase.
   */
  lowercase?: boolean;
  /**
   * Requires the final value to be uppercase.
   */
  uppercase?: boolean;
}

/**
 * Creates a string schema with optional normalization and constraints.
 */
export function string(options: StringOptions = {}) {
  return createSchema(
    "string",
    (input, path) => {
      if (typeof input !== "string") {
        throwValidation(path, "Expected string", "invalid_type");
      }

      let value = input;

      if (options.trim) {
        value = value.trim();
      }

      if (options.toLowerCase) {
        value = value.toLowerCase();
      }

      if (options.toUpperCase) {
        value = value.toUpperCase();
      }

      if (options.minLength !== undefined && value.length < options.minLength) {
        throwValidation(
          path,
          `String must have at least ${options.minLength} characters`,
          "too_small",
        );
      }

      if (options.maxLength !== undefined && value.length > options.maxLength) {
        throwValidation(
          path,
          `String must have at most ${options.maxLength} characters`,
          "too_big",
        );
      }

      if (options.email) {
        const isValid = isValidEmail(value);
        if (!isValid) {
          throwValidation(path, "Invalid email", "invalid_email");
        }
      }

      if (options.url) {
        const parsed = tryParseUrl(value);
        if (!parsed) {
          throwValidation(path, "Invalid URL", "invalid_url");
        }

        if (
          options.urlProtocols &&
          options.urlProtocols.length > 0 &&
          !options.urlProtocols.includes(parsed.protocol)
        ) {
          throwValidation(
            path,
            `URL protocol must be one of: ${options.urlProtocols.join(", ")}`,
            "invalid_url_protocol",
          );
        }
      }

      if (options.uuid) {
        const version = options.uuid === true ? "all" : options.uuid;
        if (!isValidUuid(value, version)) {
          throwValidation(path, "Invalid UUID", "invalid_uuid");
        }
      }

      if (
        options.startsWith !== undefined &&
        !value.startsWith(options.startsWith)
      ) {
        throwValidation(
          path,
          `String must start with "${options.startsWith}"`,
          "invalid_prefix",
        );
      }

      if (options.endsWith !== undefined && !value.endsWith(options.endsWith)) {
        throwValidation(
          path,
          `String must end with "${options.endsWith}"`,
          "invalid_suffix",
        );
      }

      if (options.includes !== undefined && !value.includes(options.includes)) {
        throwValidation(
          path,
          `String must include "${options.includes}"`,
          "invalid_contains",
        );
      }

      if (options.pattern !== undefined) {
        options.pattern.lastIndex = 0;
        if (!options.pattern.test(value)) {
          throwValidation(
            path,
            "String does not match required pattern",
            "invalid_pattern",
          );
        }
      }

      if (options.alpha && !/^[A-Za-z]+$/.test(value)) {
        throwValidation(
          path,
          "String must contain only letters",
          "invalid_alpha",
        );
      }

      if (options.alphanumeric && !/^[A-Za-z0-9]+$/.test(value)) {
        throwValidation(
          path,
          "String must contain only letters and numbers",
          "invalid_alphanumeric",
        );
      }

      if (options.ascii && !/^[\x00-\x7F]*$/.test(value)) {
        throwValidation(
          path,
          "String must contain only ASCII characters",
          "invalid_ascii",
        );
      }

      if (options.lowercase && value !== value.toLowerCase()) {
        throwValidation(path, "String must be lowercase", "invalid_lowercase");
      }

      if (options.uppercase && value !== value.toUpperCase()) {
        throwValidation(path, "String must be uppercase", "invalid_uppercase");
      }

      return value;
    },
    () => {
      const openApi: Record<string, unknown> = { type: "string" };
      if (options.minLength !== undefined) {
        openApi.minLength = options.minLength;
      }
      if (options.maxLength !== undefined) {
        openApi.maxLength = options.maxLength;
      }
      if (options.email) {
        openApi.format = "email";
      }
      if (options.url) {
        openApi.format = "uri";
      }
      if (options.uuid) {
        openApi.format = "uuid";
      }
      if (options.pattern) {
        openApi.pattern = options.pattern.source;
      }
      return openApi;
    },
  );
}

/**
 * Creates a number schema (with optional string coercion).
 */
export function number(options: NumberOptions = {}) {
  return createSchema(
    "number",
    (input, path) => {
      let value = input;

      if (options.coerce && typeof input === "string") {
        const normalized = input.trim();
        if (normalized !== "") {
          value = Number(normalized);
        }
      }

      if (typeof value !== "number" || !Number.isFinite(value)) {
        throwValidation(path, "Expected finite number", "invalid_type");
      }

      if (options.int && !Number.isInteger(value)) {
        throwValidation(path, "Expected integer", "invalid_integer");
      }

      if (options.min !== undefined && value < options.min) {
        throwValidation(path, `Number must be >= ${options.min}`, "too_small");
      }

      if (options.max !== undefined && value > options.max) {
        throwValidation(path, `Number must be <= ${options.max}`, "too_big");
      }

      if (options.positive && value <= 0) {
        throwValidation(path, "Number must be > 0", "not_positive");
      }

      if (options.negative && value >= 0) {
        throwValidation(path, "Number must be < 0", "not_negative");
      }

      if (
        options.multipleOf !== undefined &&
        !isMultipleOf(value, options.multipleOf)
      ) {
        throwValidation(
          path,
          `Number must be a multiple of ${options.multipleOf}`,
          "not_multiple_of",
        );
      }

      return value;
    },
    () => {
      const openApi: Record<string, unknown> = {
        type: options.int ? "integer" : "number",
      };
      if (options.min !== undefined) {
        openApi.minimum = options.min;
      }
      if (options.max !== undefined) {
        openApi.maximum = options.max;
      }
      if (options.multipleOf !== undefined) {
        openApi.multipleOf = options.multipleOf;
      }
      return openApi;
    },
  );
}

/**
 * Creates a boolean schema.
 */
export function boolean() {
  return createSchema(
    "boolean",
    (input, path) => {
      if (typeof input !== "boolean") {
        throwValidation(path, "Expected boolean", "invalid_type");
      }

      return input;
    },
    () => ({ type: "boolean" }),
  );
}

/**
 * Creates a schema that accepts only the provided literal value.
 */
export function literal<T extends string | number | boolean>(value: T) {
  return createSchema(
    "literal",
    (input, path) => {
      if (input !== value) {
        throwValidation(
          path,
          `Expected literal ${String(value)}`,
          "invalid_literal",
        );
      }

      return value;
    },
    () => ({ enum: [value] }),
  );
}

function isValidEmail(value: string): boolean {
  const at = value.indexOf("@");
  if (at <= 0 || at >= value.length - 1) {
    return false;
  }

  if (value.indexOf("@", at + 1) !== -1) {
    return false;
  }

  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  return local.length > 0 && domain.length > 0 && domain.includes(".");
}

function tryParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isValidUuid(value: string, version: "3" | "4" | "5" | "all"): boolean {
  const regexByVersion: Record<"3" | "4" | "5" | "all", RegExp> = {
    "3": /^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "4": /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "5": /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    all: /^[0-9a-f]{8}-[0-9a-f]{4}-[345][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  };

  return regexByVersion[version].test(value);
}

function isMultipleOf(value: number, divisor: number): boolean {
  if (divisor === 0) {
    return false;
  }

  const quotient = value / divisor;
  return Math.abs(quotient - Math.round(quotient)) < Number.EPSILON;
}
