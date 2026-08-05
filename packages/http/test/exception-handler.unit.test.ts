import assert from "node:assert/strict";
import test from "node:test";
import { defaultExceptionHandler } from "../src/errors/exception-handler";
import { HttpException } from "../src/errors/http-exception";
import { BadRequestException } from "../src/errors/http-exceptions";

const ctx = {} as any;

test("exception handler preserves HttpException status/headers/details", () => {
  const err = new HttpException("boom", 418, {
    code: "TEAPOT",
    details: { a: 1 },
    headers: { "x-test": "1" },
  });

  const serialized = defaultExceptionHandler(err, ctx);
  assert.equal(serialized.status, 418);
  assert.equal(serialized.headers?.["x-test"], "1");
  assert.equal((serialized.body as any).code, "TEAPOT");
  assert.deepEqual((serialized.body as any).details, { a: 1 });
});

test("exception handler maps validation-like errors to 400 with path message", () => {
  const validationError = {
    name: "ValidationError",
    issues: [{ path: ["user", "email"], message: "Invalid email" }],
  };

  const serialized = defaultExceptionHandler(validationError, ctx);
  assert.equal(serialized.status, 400);
  assert.equal(
    (serialized.body as any).message,
    'Invalid "user.email": Invalid email',
  );
});

test("exception handler maps URIError to BadRequest", () => {
  const serialized = defaultExceptionHandler(new URIError("bad uri"), ctx);
  assert.equal(serialized.status, 400);
  assert.equal((serialized.body as any).message, "Malformed URL");
});

test("exception handler maps unknown errors to InternalServerError", () => {
  const serialized = defaultExceptionHandler(new Error("x"), ctx);
  assert.equal(serialized.status, 500);
  assert.equal((serialized.body as any).message, "Internal Server Error");
});

test("bad request exception default payload is serialized", () => {
  const serialized = defaultExceptionHandler(new BadRequestException(), ctx);
  assert.equal(serialized.status, 400);
  assert.equal((serialized.body as any).message, "Bad Request");
});
