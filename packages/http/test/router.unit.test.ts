import assert from "node:assert/strict";
import test from "node:test";
import type { RouteDefinition } from "../src/routing/route-definition";
import { Router } from "../src/routing/router";

function route(
  method: RouteDefinition["method"],
  path: string,
): RouteDefinition {
  return {
    method,
    path,
    handler: () => undefined,
  };
}

test("router matches static and param routes with query parsing", () => {
  const router = new Router();
  router.register(route("GET", "/users/:id"));

  const match = router.match("GET", "/users/42?tag=a&tag=b&single=x");
  assert.ok(match);
  assert.equal(match.route.path, "/users/:id");
  assert.equal(match.params.id, "42");
  assert.deepEqual(match.query.tag, ["a", "b"]);
  assert.equal(match.query.single, "x");
});

test("router prefers static segment over param segment", () => {
  const router = new Router();
  router.register(route("GET", "/users/me"));
  router.register(route("GET", "/users/:id"));

  const match = router.match("GET", "/users/me");
  assert.ok(match);
  assert.equal(match.route.path, "/users/me");
});

test("router detects duplicate route registration", () => {
  const router = new Router();
  router.register(route("GET", "/same"));
  assert.throws(
    () => router.register(route("GET", "/same")),
    /already registered/,
  );
});

test("router resolves allowed methods for a path", () => {
  const router = new Router();
  router.register(route("GET", "/health"));
  router.register(route("POST", "/health"));

  const methods = router.allowedMethods("/health");
  assert.deepEqual(methods, ["GET", "POST"]);
});

test("router clear removes all routes", () => {
  const router = new Router();
  router.register(route("GET", "/a"));
  assert.ok(router.match("GET", "/a"));

  router.clear();
  assert.equal(router.match("GET", "/a"), null);
});
