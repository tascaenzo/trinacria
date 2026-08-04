import assert from "node:assert/strict";
import test from "node:test";
import { createSchema } from "../src/core/schema.ts";
import { s, ValidationError } from "../src/index.ts";

test("string constraints expose expected validation codes", () => {
  assert.equal(s.string({ email: true }).safeParse("not-email").success, false);
  assert.equal(s.string({ url: true }).safeParse("not-a-url").success, false);
  assert.equal(
    s
      .string({ url: true, urlProtocols: ["https:"] })
      .safeParse("http://trinacria.dev").success,
    false,
  );
  assert.equal(
    s.string({ uuid: "4" }).safeParse("550e8400-e29b-41d4-a716-446655440000")
      .success,
    true,
  );
  assert.equal(
    s.string({ uuid: "4" }).safeParse("550e8400-e29b-31d4-a716-446655440000")
      .success,
    false,
  );
  assert.equal(
    s.string({ startsWith: "pre" }).safeParse("value").success,
    false,
  );
  assert.equal(s.string({ endsWith: "suf" }).safeParse("value").success, false);
  assert.equal(s.string({ includes: "mid" }).safeParse("value").success, false);
  assert.equal(
    s.string({ pattern: /^[a-z]+$/ }).safeParse("A1").success,
    false,
  );
  assert.equal(s.string({ alpha: true }).safeParse("abc1").success, false);
  assert.equal(
    s.string({ alphanumeric: true }).safeParse("abc-1").success,
    false,
  );
  assert.equal(s.string({ lowercase: true }).safeParse("Abc").success, false);
  assert.equal(s.string({ uppercase: true }).safeParse("AbC").success, false);
  assert.equal(s.string({ ip: "v4" }).safeParse("999.1.1.1").success, false);
  assert.equal(
    s.string({ hostname: true }).safeParse("bad host").success,
    false,
  );
  assert.equal(s.string({ semver: true }).safeParse("1.2").success, false);
  assert.equal(
    s.string({ semverRange: true }).safeParse("^1.2.3 || >=2.0.0").success,
    true,
  );
  assert.equal(
    s.string({ semverRange: { allowOr: false } }).safeParse("^1.2.3 || >=2.0.0")
      .success,
    false,
  );
});

test("number branches: coercion edge cases and sign constraints", () => {
  const coerceNumber = s.number({ coerce: true });
  assert.equal(coerceNumber.safeParse("   ").success, false);
  assert.equal(s.number({ max: 3 }).safeParse(5).success, false);
  assert.equal(s.number({ positive: true }).safeParse(0).success, false);
  assert.equal(s.number({ negative: true }).safeParse(0).success, false);
});

test("boolean coercion does not coerce unsupported numeric values", () => {
  const schema = s.boolean({ coerce: true });
  assert.throws(() => schema.parse(2), ValidationError);
});

test("array branches: invalid_type, too_small, too_big and unique=true", () => {
  assert.equal(s.array(s.string()).safeParse({}).success, false);
  assert.equal(
    s.array(s.string(), { nonEmpty: true }).safeParse([]).success,
    false,
  );
  assert.equal(
    s.array(s.string(), { maxItems: 1 }).safeParse(["a", "b"]).success,
    false,
  );
  assert.equal(
    s.array(s.number(), { unique: true }).safeParse([1, 1]).success,
    false,
  );
});

test("object branches: invalid_type, unknown keys and minProperties", () => {
  assert.equal(s.object({ id: s.number() }).safeParse(null).success, false);
  assert.equal(
    s.object({ id: s.number() }, { strict: true }).safeParse({ id: 1, x: 2 })
      .success,
    false,
  );
  assert.equal(
    s
      .object(
        {
          id: s.optional(s.number()),
          name: s.optional(s.string()),
        },
        { minProperties: 2 },
      )
      .safeParse({ id: 1 }).success,
    false,
  );
});

test("date/dateString/dateTimeString negative branches", () => {
  assert.equal(s.date().safeParse("2024-01-01").success, false);
  assert.equal(
    s
      .date({ min: new Date("2024-01-02T00:00:00.000Z") })
      .safeParse(new Date("2024-01-01T00:00:00.000Z")).success,
    false,
  );
  assert.equal(
    s
      .date({ max: new Date("2024-01-02T00:00:00.000Z") })
      .safeParse(new Date("2024-01-03T00:00:00.000Z")).success,
    false,
  );

  assert.equal(s.dateString().safeParse(123).success, false);
  assert.equal(s.dateString().safeParse("2024-02-30").success, false);
  assert.equal(
    s.dateString({ min: "2024-02-01" }).safeParse("2024-01-31").success,
    false,
  );

  assert.equal(
    s.dateTimeString({ coerce: true }).safeParse(Number.NaN).success,
    false,
  );
  assert.equal(
    s.dateTimeString().safeParse("2024-01-01 10:00:00").success,
    false,
  );
  assert.equal(
    s.dateTimeString().safeParse("2024-13-01T10:00:00Z").success,
    false,
  );
  assert.equal(
    s
      .dateTimeString({ min: new Date("2024-01-02T00:00:00.000Z") })
      .safeParse("2024-01-01T00:00:00.000Z").success,
    false,
  );
  assert.equal(
    s
      .dateTimeString({ max: new Date("2024-01-02T00:00:00.000Z") })
      .safeParse("2024-01-03T00:00:00.000Z").success,
    false,
  );
});

test("union emits invalid_union when branches fail with empty issue lists", () => {
  const emptyIssueSchema = createSchema(
    "empty_issue",
    () => {
      throw new ValidationError([]);
    },
    () => ({ type: "string" }),
  );

  const schema = s.union([emptyIssueSchema] as const);
  const result = schema.safeParse("value");

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.issues.length, 1);
    assert.equal(result.error.issues[0].code, "invalid_union");
  }
});
