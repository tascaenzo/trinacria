import assert from "node:assert/strict";
import test from "node:test";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  MethodNotAllowedException,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  TooManyRequestsException,
  UnauthorizedException,
  UnprocessableEntityException,
} from "../src/errors/http-exceptions";

test("named http exceptions expose expected status codes", () => {
  assert.equal(new BadRequestException().getStatus(), 400);
  assert.equal(new UnauthorizedException().getStatus(), 401);
  assert.equal(new ForbiddenException().getStatus(), 403);
  assert.equal(new NotFoundException().getStatus(), 404);
  assert.equal(new ConflictException().getStatus(), 409);
  assert.equal(new PayloadTooLargeException().getStatus(), 413);
  assert.equal(new UnprocessableEntityException().getStatus(), 422);
  assert.equal(new TooManyRequestsException().getStatus(), 429);
  assert.equal(new InternalServerErrorException().getStatus(), 500);
  assert.equal(new ServiceUnavailableException().getStatus(), 503);
});

test("method not allowed exception sets allow header", () => {
  const err = new MethodNotAllowedException(["GET", "POST"]);
  assert.equal(err.getStatus(), 405);
  assert.equal(err.headers?.allow, "GET, POST");
});
