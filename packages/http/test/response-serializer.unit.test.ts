import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { HttpResponse } from "../src/response/http-response";
import { defaultResponseSerializer } from "../src/response/response-serializer";

const ctx = {} as any;

test("serializer returns text/plain for string", () => {
  const serialized = defaultResponseSerializer("hello", ctx);
  assert.equal(
    serialized.headers?.["content-type"],
    "text/plain; charset=utf-8",
  );
  assert.equal(serialized.body, "hello");
});

test("serializer returns binary content-type for Buffer/Uint8Array/Readable", () => {
  const b1 = defaultResponseSerializer(Buffer.from("a"), ctx);
  assert.equal(b1.headers?.["content-type"], "application/octet-stream");

  const b2 = defaultResponseSerializer(new Uint8Array([1, 2]), ctx);
  assert.equal(b2.headers?.["content-type"], "application/octet-stream");

  const b3 = defaultResponseSerializer(Readable.from(["x"]), ctx);
  assert.equal(b3.headers?.["content-type"], "application/octet-stream");
});

test("serializer returns json buffer for plain object", () => {
  const serialized = defaultResponseSerializer({ ok: true }, ctx);
  assert.equal(serialized.headers?.["content-type"], "application/json");
  assert.equal(Buffer.isBuffer(serialized.body), true);
  assert.equal((serialized.body as Buffer).toString("utf8"), '{"ok":true}');
});

test("serializer respects explicit HttpResponse status/headers/content-type", () => {
  const response = new HttpResponse("body", {
    status: 201,
    headers: { "Content-Type": "text/custom" },
  });
  const serialized = defaultResponseSerializer(response, ctx);

  assert.equal(serialized.status, 201);
  assert.equal(serialized.headers?.["Content-Type"], "text/custom");
});
