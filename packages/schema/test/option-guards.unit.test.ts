import test from "node:test";
import assert from "node:assert/strict";
import { s } from "../src/index.ts";

test("string guardrails reject invalid length options", () => {
  assert.throws(() => s.string({ minLength: -1 }), /minLength/);
  assert.throws(() => s.string({ maxLength: -1 }), /maxLength/);
  assert.throws(
    () => s.string({ minLength: 10, maxLength: 5 }),
    /minLength cannot be greater than maxLength/,
  );
});

test("number guardrails reject invalid bounds and multipleOf", () => {
  assert.throws(
    () => s.number({ min: Number.POSITIVE_INFINITY }),
    /min must be a finite number/,
  );
  assert.throws(
    () => s.number({ max: Number.NEGATIVE_INFINITY }),
    /max must be a finite number/,
  );
  assert.throws(() => s.number({ min: 5, max: 4 }), /min cannot be greater/);
  assert.throws(() => s.number({ multipleOf: -2 }), /multipleOf/);
});

test("array guardrails reject invalid item bounds", () => {
  assert.throws(() => s.array(s.string(), { minItems: -1 }), /minItems/);
  assert.throws(() => s.array(s.string(), { maxItems: -1 }), /maxItems/);
  assert.throws(
    () => s.array(s.string(), { minItems: 3, maxItems: 2 }),
    /minItems cannot be greater than maxItems/,
  );
});

test("object guardrails reject invalid minProperties", () => {
  assert.throws(
    () => s.object({ id: s.string() }, { minProperties: -1 }),
    /minProperties/,
  );
});

test("union guardrails reject empty schemas and invalid maxIssues", () => {
  assert.throws(() => s.union([] as const), /at least one schema/);
  assert.throws(
    () => s.union([s.string(), s.number()] as const, { maxIssues: 0 }),
    /maxIssues must be a positive integer/,
  );
});

test("tuple guardrails reject empty schema list", () => {
  assert.throws(() => s.tuple([] as const), /at least one schema/);
});

test("date guardrails reject invalid min/max configurations", () => {
  assert.throws(
    () => s.date({ min: new Date("invalid") }),
    /min must be a valid Date/,
  );
  assert.throws(
    () => s.date({ max: new Date("invalid") }),
    /max must be a valid Date/,
  );
  assert.throws(
    () =>
      s.date({
        min: new Date("2024-12-01T00:00:00.000Z"),
        max: new Date("2024-01-01T00:00:00.000Z"),
      }),
    /min cannot be greater than max/,
  );
});

test("dateString guardrails reject invalid formats and ranges", () => {
  assert.throws(() => s.dateString({ min: "2024-1-1" }), /YYYY-MM-DD/);
  assert.throws(() => s.dateString({ max: "2024-13-01" }), /YYYY-MM-DD/);
  assert.throws(
    () => s.dateString({ min: "2024-12-31", max: "2024-01-01" }),
    /min cannot be greater than max/,
  );
});

test("dateTimeString guardrails reject invalid min/max configurations", () => {
  assert.throws(
    () => s.dateTimeString({ min: new Date("invalid") }),
    /min must be a valid Date/,
  );
  assert.throws(
    () => s.dateTimeString({ max: new Date("invalid") }),
    /max must be a valid Date/,
  );
  assert.throws(
    () =>
      s.dateTimeString({
        min: new Date("2024-12-31T00:00:00.000Z"),
        max: new Date("2024-01-01T00:00:00.000Z"),
      }),
    /min cannot be greater than max/,
  );
});
