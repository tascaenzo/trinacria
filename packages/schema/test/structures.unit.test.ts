import test from "node:test";
import assert from "node:assert/strict";
import { s, ValidationError, formatValidationError } from "../src/index.ts";

test("object validates required fields and strict unknown keys", () => {
  const schema = s.object(
    {
      id: s.number({ int: true }),
      name: s.string({ minLength: 2 }),
    },
    { strict: true },
  );

  const parsed = schema.parse({ id: 1, name: "enzo" });
  assert.equal(parsed.id, 1);
  assert.throws(() => schema.parse({ id: 1, name: "x" }), ValidationError);
  assert.throws(
    () => schema.parse({ id: 1, name: "enzo", role: "admin" }),
    ValidationError,
  );
});

test("object returns nested error paths", () => {
  const schema = s.object({
    profile: s.object({
      email: s.string({ email: true }),
      tags: s.array(s.string({ minLength: 3 })),
    }),
  });

  const result = schema.safeParse({
    profile: {
      email: "not-email",
      tags: ["ok", "x"],
    },
  });

  assert.equal(result.success, false);
  if (!result.success) {
    const message = formatValidationError(result.error);
    assert.equal(message.includes("profile.email"), true);
    assert.equal(message.includes("Invalid email"), true);
  }
});

test("array supports coercion, min/max and uniqueness selector", () => {
  const schema = s.array(
    s.object({
      id: s.number({ int: true }),
      value: s.string(),
    }),
    {
      minItems: 1,
      maxItems: 3,
      unique: (item) => item.id,
    },
  );

  assert.equal(
    s.array(s.number({ coerce: true }), { coerce: { separator: ";" } }).parse(
      "1; 2; 3",
    ).length,
    3,
  );

  assert.equal(schema.parse([{ id: 1, value: "a" }]).length, 1);
  assert.throws(
    () =>
      schema.parse([
        { id: 1, value: "a" },
        { id: 1, value: "b" },
      ]),
    ValidationError,
  );
});

test("union accepts first matching branch", () => {
  const schema = s.union(
    [
      s.object({ a: s.number({ int: true }) }),
      s.object({ b: s.string({ minLength: 5 }) }),
    ] as const,
  );

  const parsed = schema.parse({ a: 10 }) as { a: number };
  assert.equal(parsed.a, 10);
});

test("union truncates nested issues when they exceed maxIssues", () => {
  const schema = s.union(
    [s.union([s.number(), s.string(), s.boolean()] as const, { maxIssues: 5 })] as const,
    { maxIssues: 2 },
  );

  const result = schema.safeParse({});
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.issues.length, 3);
    const hasTruncated = result.error.issues.some(
      (issue) => issue.code === "issues_truncated",
    );
    assert.equal(hasTruncated, true);
  }
});

test("date/dateString/dateTimeString support coercion and ranges", () => {
  const dateSchema = s.date({
    coerce: true,
    min: new Date("2024-01-01T00:00:00.000Z"),
  });
  const parsedDate = dateSchema.parse("2024-05-01T12:00:00.000Z");
  assert.equal(parsedDate instanceof Date, true);

  const dateStringSchema = s.dateString({
    coerce: true,
    min: "2024-01-01",
    max: "2024-12-31",
  });
  assert.equal(
    dateStringSchema.parse(new Date("2024-07-15T00:00:00.000Z")),
    "2024-07-15",
  );
  assert.throws(() => dateStringSchema.parse("2025-01-01"), ValidationError);

  const dateTimeSchema = s.dateTimeString({
    coerce: true,
    max: new Date("2024-12-31T23:59:59.999Z"),
  });
  assert.equal(
    dateTimeSchema.parse(new Date("2024-03-01T10:00:00.000Z")),
    "2024-03-01T10:00:00.000Z",
  );
  assert.throws(
    () => dateTimeSchema.parse("not-a-date-time"),
    ValidationError,
  );
});

test("object builder rejects forbidden keys in schema shape", () => {
  assert.throws(
    () =>
      s.object({
        constructor: s.string(),
      } as Record<string, unknown> as any),
    /forbidden key/,
  );
});
