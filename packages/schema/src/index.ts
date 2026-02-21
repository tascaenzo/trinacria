export { ValidationError, type ValidationIssue, type Path } from "./errors";
export type { Schema, ParseResult, ParseOk, ParseFail, Infer } from "./core";
export type { OpenApiSchemaObject } from "./openapi";
export { toOpenApi } from "./openapi";

import {
  array,
  boolean,
  date,
  dateString,
  dateTimeString,
  defaultValue,
  enumSchema,
  literal,
  nullable,
  number,
  object,
  objectOf,
  optional,
  string,
  union,
  type ArrayOptions,
  type BooleanOptions,
  type DateOptions,
  type DateStringOptions,
  type DateTimeStringOptions,
  type NumberOptions,
  type ObjectOptions,
  type SchemaShape,
  type StringOptions,
  type UnionOptions,
} from "./builders";
import type { Infer, Schema } from "./core";

export const s = {
  string,
  number,
  boolean,
  date,
  dateString,
  dateTimeString,
  literal,
  array,
  object,
  objectOf,
  optional,
  nullable,
  default: defaultValue,
  enum: enumSchema,
  union,
};

export {
  string,
  number,
  boolean,
  date,
  dateString,
  dateTimeString,
  literal,
  array,
  object,
  objectOf,
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
  SchemaShape,
  UnionOptions,
};

export type InferObject<T extends Record<string, Schema<unknown>>> = {
  [K in keyof T]: Infer<T[K]>;
};
