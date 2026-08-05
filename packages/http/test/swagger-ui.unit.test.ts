import assert from "node:assert/strict";
import test from "node:test";
import { UnauthorizedException } from "../src/errors";
import {
  basicAuth,
  createSwaggerUiDocument,
  createSwaggerUiInitializer,
  readSwaggerUiAsset,
} from "../src/openapi/swagger-ui";

test("swagger UI document uses same-origin assets and escapes title", () => {
  const html = createSwaggerUiDocument({
    title: '<script>alert("x")</script>',
  });
  assert.doesNotMatch(html, /https?:\/\//);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /\/docs\/assets\/swagger-ui-bundle\.js/);
});

test("swagger initializer disables persisted authorization", () => {
  const script = createSwaggerUiInitializer("/api/openapi.json");
  assert.match(script, /persistAuthorization: false/);
  assert.match(script, /"\/api\/openapi\.json"/);
});

test("swagger UI assets resolve from the pinned application dependency", async () => {
  const asset = await readSwaggerUiAsset("swagger-ui.css");
  assert.ok(asset.length > 1_000);
});

test("basic auth middleware protects the OpenAPI JSON route", async () => {
  const middleware = basicAuth({
    username: "docs",
    password: "secure-password",
    realm: "Docs",
  });
  const next = async () => {};

  await assert.rejects(
    () => middleware({ req: { headers: {} } } as never, next),
    UnauthorizedException,
  );

  let called = false;
  await middleware(
    {
      req: {
        headers: {
          authorization: `Basic ${Buffer.from("docs:secure-password").toString("base64")}`,
        },
      },
    } as never,
    async () => {
      called = true;
    },
  );
  assert.equal(called, true);
});
