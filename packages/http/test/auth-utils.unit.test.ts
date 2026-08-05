import assert from "node:assert/strict";
import test from "node:test";
import {
  isSafeHttpMethod,
  parseBearerToken,
  readCookieValue,
  readHeaderValue,
  resolveClientAddress,
} from "../src/auth/http-auth-utils";

test("parseBearerToken extracts token from Bearer header", () => {
  assert.equal(parseBearerToken("Bearer abc"), "abc");
  assert.equal(parseBearerToken("bearer abc"), "abc");
  assert.equal(parseBearerToken("Basic abc"), undefined);
  assert.equal(parseBearerToken(undefined), undefined);
});

test("readHeaderValue handles string/array/undefined", () => {
  assert.equal(readHeaderValue("x"), "x");
  assert.equal(readHeaderValue(["x", "y"]), "x");
  assert.equal(readHeaderValue(undefined), undefined);
});

test("readCookieValue parses and decodes cookie values", () => {
  assert.equal(readCookieValue("a=1; token=abc%20123", "token"), "abc 123");
  assert.equal(readCookieValue("a=1; token=", "token"), undefined);
  assert.equal(readCookieValue(undefined, "token"), undefined);
  assert.equal(readCookieValue("a=1", "missing"), undefined);
});

test("isSafeHttpMethod returns true for safe methods only", () => {
  assert.equal(isSafeHttpMethod("GET"), true);
  assert.equal(isSafeHttpMethod("head"), true);
  assert.equal(isSafeHttpMethod("OPTIONS"), true);
  assert.equal(isSafeHttpMethod("POST"), false);
  assert.equal(isSafeHttpMethod(undefined), true);
});

test("resolveClientAddress honors x-forwarded-for only when trustProxy=true", () => {
  const ctx = {
    req: {
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
      socket: { remoteAddress: "127.0.0.1" },
    },
  } as any;

  assert.equal(resolveClientAddress(ctx, false), "127.0.0.1");
  assert.equal(resolveClientAddress(ctx, true), "203.0.113.1");
});
