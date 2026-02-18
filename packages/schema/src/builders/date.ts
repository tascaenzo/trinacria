import { createSchema } from "../core";
import { throwValidation } from "../errors";

export interface DateOptions {
  /**
   * Converts string/number inputs into Date before validation.
   */
  coerce?: boolean;
  /**
   * Inclusive minimum date.
   */
  min?: Date;
  /**
   * Inclusive maximum date.
   */
  max?: Date;
}

export interface DateStringOptions {
  /**
   * Converts Date inputs into YYYY-MM-DD.
   */
  coerce?: boolean;
  /**
   * Inclusive minimum date in YYYY-MM-DD format.
   */
  min?: string;
  /**
   * Inclusive maximum date in YYYY-MM-DD format.
   */
  max?: string;
}

export interface DateTimeStringOptions {
  /**
   * Converts Date/number inputs into ISO date-time string.
   */
  coerce?: boolean;
  /**
   * Inclusive minimum date-time.
   */
  min?: Date;
  /**
   * Inclusive maximum date-time.
   */
  max?: Date;
}

/**
 * Creates a schema for JavaScript Date values.
 */
export function date(options: DateOptions = {}) {
  return createSchema(
    "date",
    (input, path) => {
      let value: unknown = input;

      if (
        options.coerce &&
        (typeof input === "string" || typeof input === "number")
      ) {
        value = new Date(input);
      }

      if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
        throwValidation(path, "Expected valid Date", "invalid_date");
      }

      if (options.min && value.getTime() < options.min.getTime()) {
        throwValidation(
          path,
          `Date must be >= ${options.min.toISOString()}`,
          "too_small",
        );
      }

      if (options.max && value.getTime() > options.max.getTime()) {
        throwValidation(
          path,
          `Date must be <= ${options.max.toISOString()}`,
          "too_big",
        );
      }

      return value;
    },
    () => ({
      type: "string",
      format: "date-time",
    }),
  );
}

/**
 * Creates a schema for date-only strings in YYYY-MM-DD format.
 */
export function dateString(options: DateStringOptions = {}) {
  return createSchema(
    "date_string",
    (input, path) => {
      let value: unknown = input;

      if (
        options.coerce &&
        input instanceof Date &&
        !Number.isNaN(input.getTime())
      ) {
        value = input.toISOString().slice(0, 10);
      }

      if (typeof value !== "string") {
        throwValidation(
          path,
          "Expected date string (YYYY-MM-DD)",
          "invalid_type",
        );
      }

      if (!isValidDateOnly(value)) {
        throwValidation(
          path,
          "Expected date string in YYYY-MM-DD format",
          "invalid_date",
        );
      }

      if (options.min && value < options.min) {
        throwValidation(path, `Date must be >= ${options.min}`, "too_small");
      }

      if (options.max && value > options.max) {
        throwValidation(path, `Date must be <= ${options.max}`, "too_big");
      }

      return value;
    },
    () => ({
      type: "string",
      format: "date",
    }),
  );
}

/**
 * Creates a schema for date-time strings.
 */
export function dateTimeString(options: DateTimeStringOptions = {}) {
  return createSchema(
    "date_time_string",
    (input, path) => {
      let value: unknown = input;

      if (options.coerce) {
        if (input instanceof Date && !Number.isNaN(input.getTime())) {
          value = input.toISOString();
        } else if (typeof input === "number") {
          const date = new Date(input);
          if (!Number.isNaN(date.getTime())) {
            value = date.toISOString();
          }
        }
      }

      if (typeof value !== "string") {
        throwValidation(path, "Expected date-time string", "invalid_type");
      }

      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        throwValidation(
          path,
          "Expected valid date-time string",
          "invalid_date",
        );
      }

      if (options.min && parsed.getTime() < options.min.getTime()) {
        throwValidation(
          path,
          `Date-time must be >= ${options.min.toISOString()}`,
          "too_small",
        );
      }

      if (options.max && parsed.getTime() > options.max.getTime()) {
        throwValidation(
          path,
          `Date-time must be <= ${options.max.toISOString()}`,
          "too_big",
        );
      }

      return value;
    },
    () => ({
      type: "string",
      format: "date-time",
    }),
  );
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return false;
  }

  if (month < 1 || month > 12) {
    return false;
  }

  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= maxDay;
}
