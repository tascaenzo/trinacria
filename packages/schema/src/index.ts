export {
  ValidationError,
  formatValidationError,
  type FormatValidationErrorOptions,
  type ValidationIssue,
  type Path,
} from "./errors";
export type {
  Schema,
  ParseResult,
  ParseOk,
  ParseFail,
  ParseMode,
  ParseOptions,
  RefineIssue,
  SuperRefineContext,
  Infer,
} from "./core";
export type { OpenApiSchemaObject } from "./openapi";
export { toOpenApi } from "./openapi";

import {
  array,
  boolean,
  date,
  dateString,
  dateTimeString,
  registerStringValidator,
  defaultValue,
  enumSchema,
  literal,
  nullable,
  number,
  object,
  objectOf,
  optional,
  record,
  string,
  tuple,
  union,
  type ArrayOptions,
  type BooleanOptions,
  type DateOptions,
  type DateStringOptions,
  type DateTimeStringOptions,
  type NumberOptions,
  type ObjectOptions,
  type SchemaShape,
  type StringCustomValidatorFn,
  type StringCustomValidatorInput,
  type StringCustomValidatorResult,
  type StringOptions,
  type UnionOptions,
} from "./builders";
import type { Infer, Schema } from "./core";

export const s = {
  string,
  registerStringValidator,
  number,
  boolean,
  date,
  dateString,
  dateTimeString,
  literal,
  array,
  tuple,
  object,
  objectOf,
  record,
  optional,
  nullable,
  default: defaultValue,
  enum: enumSchema,
  union,
};

export {
  string,
  registerStringValidator,
  number,
  boolean,
  date,
  dateString,
  dateTimeString,
  literal,
  array,
  tuple,
  object,
  objectOf,
  record,
  optional,
  nullable,
  defaultValue as default,
  enumSchema as enum,
  union,
};

export type {
  ArrayOptions,
  DateOptions,
  DateStringOptions,
  DateTimeStringOptions,
  BooleanOptions,
  ObjectOptions,
  NumberOptions,
  StringOptions,
  StringCustomValidatorInput,
  StringCustomValidatorResult,
  StringCustomValidatorFn,
  SchemaShape,
  UnionOptions,
};

export type InferObject<T extends Record<string, Schema<unknown>>> = {
  [K in keyof T]: Infer<T[K]>;
};
