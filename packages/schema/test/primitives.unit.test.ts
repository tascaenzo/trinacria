import test from "node:test";
import assert from "node:assert/strict";
import { s, ValidationError } from "../src/index.ts";

test("string applies trim and case transforms before constraints", () => {
  const schema = s.string({
    trim: true,
    toLowerCase: true,
    startsWith: "ab",
    minLength: 4,
  });

  const parsed = schema.parse("  ABcd  ");
  assert.equal(parsed, "abcd");
});

test("string validates protocol-restricted URL", () => {
  const schema = s.string({
    url: true,
    urlProtocols: ["https:"],
  });

  assert.equal(schema.parse("https://trinacria.dev"), "https://trinacria.dev");
  assert.throws(() => schema.parse("http://trinacria.dev"), ValidationError);
});

test("string rejects non-ASCII when ascii option is enabled", () => {
  const schema = s.string({ ascii: true });
  assert.throws(() => schema.parse("caffè"), ValidationError);
});

test("number supports coercion and multipleOf checks", () => {
  const schema = s.number({ coerce: true, int: true, multipleOf: 3, min: 3 });
  assert.equal(schema.parse("12"), 12);
  assert.throws(() => schema.parse("10"), ValidationError);
});

test("number option validation fails for invalid multipleOf", () => {
  assert.throws(() => s.number({ multipleOf: 0 }), /multipleOf/);
});

test("boolean coercion accepts true/false and 1/0 forms", () => {
  const schema = s.boolean({ coerce: true });

  assert.equal(schema.parse("true"), true);
  assert.equal(schema.parse("0"), false);
  assert.equal(schema.parse(1), true);
  assert.throws(() => schema.parse("yes"), ValidationError);
});

test("literal accepts only exact value", () => {
  const schema = s.literal("admin");
  assert.equal(schema.parse("admin"), "admin");
  assert.throws(() => schema.parse("user"), ValidationError);
});

test("enum schema accepts only declared values", () => {
  const schema = s.enum(["draft", "published"] as const);
  assert.equal(schema.parse("draft"), "draft");
  assert.throws(() => schema.parse("archived"), ValidationError);
});

test("safeParse returns structured ValidationError", () => {
  const schema = s.number({ int: true });
  const result = schema.safeParse(1.2);

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.issues[0].code, "invalid_integer");
  }
});

test("optional/nullable/default modifiers work as expected", () => {
  assert.equal(s.optional(s.string()).parse(undefined), undefined);
  assert.equal(s.nullable(s.string()).parse(null), null);
  assert.equal(s.default(s.number(), 42).parse(undefined), 42);
});
