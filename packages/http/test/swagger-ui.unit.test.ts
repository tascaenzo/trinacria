import assert from "node:assert/strict";
import test from "node:test";
import { UnauthorizedException } from "../src/errors";
import {
  basicAuth,
  createSwaggerUiDocument,
  createSwaggerUiInitializer,
  readSwaggerUiAsset,
  SwaggerUiController,
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

test("swagger controller exposes protected same-origin routes", async () => {
  const controller = new SwaggerUiController({
    title: "Private API",
    openApiPath: "/api/openapi.json",
    assetBasePath: "custom-assets/",
    basicAuth: { username: "docs", password: "secret", realm: "Private" },
  });

  assert.equal(controller.routes().length, 5);

  const unauthorized = controller.renderDocs({
    req: { headers: {} },
  } as never);
  assert.equal(unauthorized.status, 401);
  assert.match(String(unauthorized.headers?.["www-authenticate"]), /Private/);

  const authorized = controller.renderDocs({
    req: {
      headers: {
        authorization: `Basic ${Buffer.from("docs:secret").toString("base64")}`,
      },
    },
  } as never);
  assert.match(String(authorized.body), /\/custom-assets\/swagger-ui\.css/);
  assert.match(
    String(authorized.headers?.["content-security-policy"]),
    /default-src 'self'/,
  );
  assert.equal(authorized.headers?.["cache-control"], "no-store");

  const initializer = controller.renderInitializer();
  assert.match(String(initializer.body), /\/api\/openapi\.json/);
  assert.equal(
    initializer.headers?.["content-type"],
    "text/javascript; charset=utf-8",
  );

  for (const asset of [
    await controller.renderSwaggerCss(),
    await controller.renderSwaggerBundle(),
    await controller.renderSwaggerPreset(),
  ]) {
    assert.equal(Buffer.isBuffer(asset.body), true);
    assert.equal(
      asset.headers?.["cache-control"],
      "public, max-age=31536000, immutable",
    );
  }
});

test("swagger controller honors disabled docs and auth edge cases", async () => {
  const disabled = new SwaggerUiController({
    title: "Disabled API",
    enabled: () => false,
  }).renderDocs({ req: { headers: {} } } as never);
  assert.equal(disabled.status, 404);

  const malformedCredentials = [
    undefined,
    "Bearer token",
    `Basic ${Buffer.from("missing-separator").toString("base64")}`,
    `Basic ${Buffer.from("docs:wrong").toString("base64")}`,
  ];
  const middleware = basicAuth({ username: "docs", password: "secret" });

  for (const authorization of malformedCredentials) {
    await assert.rejects(
      middleware(
        { req: { headers: { authorization } } } as never,
        async () => undefined,
      ),
      UnauthorizedException,
    );
  }

  await assert.rejects(
    basicAuth({ username: "docs" })(
      {
        req: {
          headers: {
            authorization: `Basic ${Buffer.from("docs:secret").toString("base64")}`,
          },
        },
      } as never,
      async () => undefined,
    ),
    UnauthorizedException,
  );
});

test("swagger document normalizes asset paths and escapes HTML characters", () => {
  const html = createSwaggerUiDocument({
    title: `A&B <C> "D" 'E'`,
    assetBasePath: "assets/",
  });

  assert.match(html, /A&amp;B &lt;C&gt; &quot;D&quot; &#39;E&#39;/);
  assert.match(html, /\/assets\/swagger-ui-bundle\.js/);
  assert.doesNotMatch(html, /\/assets\/\/swagger-ui-bundle/);
});
