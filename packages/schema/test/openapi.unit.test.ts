import test from "node:test";
import assert from "node:assert/strict";
import { s, toOpenApi, ValidationError } from "../src/index.ts";
import { createSchema } from "../src/core/schema.ts";

test("toOpenApi maps object required/additionalProperties/minProperties", () => {
  const schema = s.object(
    {
      id: s.number({ int: true }),
      nickname: s.optional(s.string()),
    },
    { strict: true, minProperties: 1 },
  );

  const openApi = toOpenApi(schema) as Record<string, unknown>;
  assert.equal(openApi.type, "object");
  assert.deepEqual(openApi.required, ["id"]);
  assert.equal(openApi.additionalProperties, false);
  assert.equal(openApi.minProperties, 1);
});

test("toOpenApi maps array and union metadata", () => {
  const schema = s.array(s.union([s.literal("a"), s.literal("b")] as const), {
    minItems: 1,
    unique: true,
  });

  const openApi = toOpenApi(schema) as Record<string, unknown>;
  assert.equal(openApi.type, "array");
  assert.equal(openApi.minItems, 1);
  assert.equal(openApi.uniqueItems, true);
  assert.equal(typeof openApi.items, "object");
});

test("toOpenApi maps record and tuple metadata", () => {
  const recordSchema = s.record(
    s.string({ pattern: /^[a-z_]+$/ }),
    s.number({ int: true }),
  );
  const tupleSchema = s.tuple([s.string({ ip: "v4" }), s.number()] as const);

  const recordOpenApi = toOpenApi(recordSchema) as Record<string, unknown>;
  assert.equal(recordOpenApi.type, "object");
  assert.equal(typeof recordOpenApi.additionalProperties, "object");
  assert.equal(typeof recordOpenApi.propertyNames, "object");

  const tupleOpenApi = toOpenApi(tupleSchema) as Record<string, unknown>;
  assert.equal(tupleOpenApi.type, "array");
  assert.equal(tupleOpenApi.minItems, 2);
  assert.equal(tupleOpenApi.maxItems, 2);
  assert.equal(Array.isArray((tupleOpenApi as any).prefixItems), true);
});

test("default and nullable modifiers project OpenAPI shape", () => {
  const schema = s.default(s.nullable(s.number()), null);
  const openApi = toOpenApi(schema) as Record<string, unknown>;

  assert.equal(openApi.default, null);
  assert.equal(Array.isArray((openApi as any).anyOf), true);
});

test("safeParse converts unexpected internal parser errors to internal_error", () => {
  const broken = createSchema(
    "broken",
    () => {
      throw new Error("unexpected");
    },
    () => ({ type: "string" }),
  );

  const result = broken.safeParse("x");
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error instanceof ValidationError, true);
    assert.equal(result.error.issues[0].code, "internal_error");
  }
});
