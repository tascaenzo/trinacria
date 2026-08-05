import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import {
  cors,
  createMemoryRateLimitStore,
  createSecurityHeadersBuilder,
  rateLimit,
  securityHeaders,
} from "../src/builtin-middlewares";
import { Router } from "../src/routing";
import { HttpServer } from "../src/server/http-server";

function createContext(
  options: {
    origin?: string;
    method?: string;
    remoteAddress?: string;
    forwardedFor?: string;
    forwardedProto?: string;
  } = {},
) {
  const headers = new Map<string, string | string[]>();
  let ended = false;

  return {
    ctx: {
      req: {
        method: options.method ?? "GET",
        headers: {
          origin: options.origin,
          "x-forwarded-for": options.forwardedFor,
          "x-forwarded-proto": options.forwardedProto,
        },
        socket: { remoteAddress: options.remoteAddress ?? "127.0.0.1" },
      },
      res: {
        statusCode: 200,
        setHeader(name: string, value: string | string[]) {
          headers.set(name.toLowerCase(), value);
        },
        getHeader(name: string) {
          return headers.get(name.toLowerCase());
        },
        getHeaders() {
          return Object.fromEntries(headers);
        },
        hasHeader(name: string) {
          return headers.has(name.toLowerCase());
        },
        end() {
          ended = true;
        },
      },
      state: {},
    } as any,
    headers,
    wasEnded: () => ended,
  };
}

test("cors rejects wildcard credentials at configuration time", () => {
  assert.throws(
    () => cors({ origin: "*", credentials: true }),
    /explicit origin allowlist/,
  );
  assert.throws(() => cors({ credentials: true }), /explicit origin allowlist/);
});

test("cors emits credentials only for an explicitly allowed origin", async () => {
  const middleware = cors({
    origin: ["https://app.example"],
    credentials: true,
  });
  const allowed = createContext({ origin: "https://app.example" });
  await middleware(allowed.ctx, async () => "ok");
  assert.equal(
    allowed.headers.get("access-control-allow-origin"),
    "https://app.example",
  );
  assert.equal(allowed.headers.get("access-control-allow-credentials"), "true");

  const denied = createContext({ origin: "https://evil.example" });
  await middleware(denied.ctx, async () => "ok");
  assert.equal(denied.headers.has("access-control-allow-origin"), false);
});

test("cors false disables cross-origin response headers", async () => {
  const middleware = cors({ origin: false, credentials: true });
  const request = createContext({ origin: "https://example.test" });
  await middleware(request.ctx, async () => undefined);
  assert.equal(request.headers.has("access-control-allow-origin"), false);
  assert.equal(request.headers.has("access-control-allow-credentials"), false);
});

test("memory rate limit store remains bounded", async () => {
  const store = createMemoryRateLimitStore(2);
  await store.increment("a", 1, 1_000);
  await store.increment("b", 2, 1_000);
  const replacement = await store.increment("c", 3, 1_000);
  assert.equal(replacement.count, 1);
  const reinserted = await store.increment("a", 4, 1_000);
  assert.equal(reinserted.count, 1);
});

test("rate limiter supports asynchronous shared stores", async () => {
  let count = 0;
  const middleware = rateLimit({
    max: 1,
    store: {
      async increment(_key, now, windowMs) {
        count += 1;
        return { count, resetAt: now + windowMs };
      },
    },
  });

  await middleware(createContext().ctx, async () => undefined);
  await assert.rejects(
    middleware(createContext().ctx, async () => undefined),
    (error: any) => error?.getStatus?.() === 429,
  );
});

test("production security preset emits CSP and baseline headers", async () => {
  const middleware = createSecurityHeadersBuilder()
    .preset("production")
    .build();
  const request = createContext();
  await middleware(request.ctx, async () => undefined);

  assert.equal(request.headers.get("x-content-type-options"), "nosniff");
  assert.match(
    String(request.headers.get("content-security-policy")),
    /default-src 'self'/,
  );
});

test("security headers emits nonce, reporting, HSTS, and policy headers", async () => {
  const builder = createSecurityHeadersBuilder()
    .mode("production")
    .trustProxy(true)
    .headers({ "x-custom-header": "enabled", "x-frame-options": false })
    .contentSecurityPolicy({
      reportOnly: true,
      overrideDirectives: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'"],
      },
      nonce: {
        generator: () => "fixed-nonce",
        stateKey: "docsNonce",
      },
      addStrictDynamicWhenNonce: true,
      reportUri: "/csp-report",
      reportTo: "csp-endpoint",
      reportToHeader: {
        group: "csp-endpoint",
        maxAge: 60.9,
        endpoints: [{ url: "https://reports.example/csp" }],
        includeSubDomains: true,
      },
    })
    .strictTransportSecurity({
      maxAge: 123.9,
      includeSubDomains: false,
      preload: true,
    })
    .permissionsPolicy({ camera: [] }, "strict")
    .crossOriginEmbedderPolicy("require-corp");

  const builtOptions = builder.buildOptions();
  assert.equal(builtOptions.mode, "production");
  assert.equal(builtOptions.trustProxy, true);

  const middleware = builder.build();

  const request = createContext({ forwardedProto: "https" });
  const result = await middleware(request.ctx, async () => "next-result");

  const csp = String(
    request.headers.get("content-security-policy-report-only"),
  );
  assert.match(csp, /script-src 'self' 'strict-dynamic' 'nonce-fixed-nonce'/);
  assert.match(csp, /style-src 'self' 'nonce-fixed-nonce'/);
  assert.match(csp, /report-uri \/csp-report/);
  assert.match(csp, /report-to csp-endpoint/);
  assert.equal(request.ctx.state.docsNonce, "fixed-nonce");
  assert.equal(
    request.headers.get("strict-transport-security"),
    "max-age=123; preload",
  );
  assert.equal(result, "next-result");
  assert.equal(request.headers.get("permissions-policy"), "camera=()");
  assert.equal(
    request.headers.get("cross-origin-embedder-policy"),
    "require-corp",
  );
  assert.equal(request.headers.get("x-custom-header"), "enabled");
  assert.equal(request.headers.has("x-frame-options"), false);

  const reportTo = JSON.parse(String(request.headers.get("report-to")));
  assert.deepEqual(reportTo, {
    group: "csp-endpoint",
    max_age: 60,
    endpoints: [{ url: "https://reports.example/csp" }],
    include_subdomains: true,
  });
});

test("security headers preserves existing response headers", async () => {
  const middleware = securityHeaders({ mode: "production" });
  const request = createContext();
  request.ctx.res.setHeader("x-content-type-options", "custom");
  request.ctx.res.setHeader("content-security-policy", "default-src 'none'");

  await middleware(request.ctx, async () => undefined);

  assert.equal(request.headers.get("x-content-type-options"), "custom");
  assert.equal(
    request.headers.get("content-security-policy"),
    "default-src 'none'",
  );
  assert.equal(request.headers.has("strict-transport-security"), false);
});

test("security header configuration rejects unsafe and malformed values", () => {
  const invalidConfigurations = [
    () => securityHeaders({ headers: { "x-test": "bad\nvalue" } }),
    () =>
      securityHeaders({
        mode: "production",
        strictTransportSecurity: { maxAge: -1 },
      }),
    () =>
      securityHeaders({
        contentSecurityPolicy: {
          directives: { "Bad Directive": ["'self'"] },
        },
      }),
    () =>
      securityHeaders({
        contentSecurityPolicy: {
          schemaValidation: "strict",
          directives: { "unknown-src": ["'self'"] },
        },
      }),
    () =>
      securityHeaders({
        contentSecurityPolicy: {
          directives: { "default-src": "'self'" as never },
        },
      }),
    () =>
      securityHeaders({
        contentSecurityPolicy: {
          directives: { "upgrade-insecure-requests": ["'self'"] },
        },
      }),
    () =>
      securityHeaders({
        contentSecurityPolicy: {
          directives: { "report-uri": ["/one", "/two"] },
        },
      }),
    () =>
      securityHeaders({
        contentSecurityPolicy: {
          schemaValidation: "strict",
          directives: { "default-src": [] },
        },
      }),
    () =>
      securityHeaders({
        contentSecurityPolicy: {
          directives: { "default-src": ["unsafe-inline"] },
        },
      }),
    () =>
      securityHeaders({
        contentSecurityPolicy: {
          directives: { "script-src": ["'nonce-invalid?'"] },
        },
      }),
    () =>
      securityHeaders({
        contentSecurityPolicy: {
          directives: { "script-src": ["'sha999-invalid'"] },
        },
      }),
    () =>
      securityHeaders({
        contentSecurityPolicy: { nonce: { stateKey: "" } },
      }),
    () =>
      securityHeaders({
        contentSecurityPolicy: {
          nonce: { generator: "invalid" as never },
        },
      }),
    () =>
      securityHeaders({
        contentSecurityPolicy: {
          reportToHeader: { maxAge: -1, endpoints: [] },
        },
      }),
    () =>
      securityHeaders({
        contentSecurityPolicy: {
          reportToHeader: { maxAge: 10, endpoints: [] },
        },
      }),
    () =>
      securityHeaders({
        contentSecurityPolicy: {
          reportToHeader: {
            maxAge: 10,
            endpoints: [{ url: "" }],
          },
        },
      }),
    () =>
      securityHeaders({
        permissionsPolicy: { "future-feature": [] },
        permissionsPolicyValidation: "strict",
      }),
    () => securityHeaders({ permissionsPolicy: { camera: "none" as never } }),
    () => securityHeaders({ permissionsPolicy: { camera: [42] as never } }),
  ];

  for (const createMiddleware of invalidConfigurations) {
    assert.throws(createMiddleware);
  }
});

test("security header warn mode reports forward-compatible policies", () => {
  const messages: string[] = [];
  const originalWarn = console.warn;
  console.warn = (message) => messages.push(String(message));

  try {
    securityHeaders({
      mode: "development",
      contentSecurityPolicy: {
        schemaValidation: "warn",
        directives: {
          "future-src": [],
          "script-src": ["unsafe-future"],
        },
      },
      permissionsPolicy: { "future-feature": [] },
      permissionsPolicyValidation: "warn",
    });
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(messages.length >= 4, true);
  assert.equal(
    messages.some((message) => /future-src/.test(message)),
    true,
  );
  assert.equal(
    messages.some((message) => /future-feature/.test(message)),
    true,
  );
});

test("HTTP server applies connection limits and bounds streaming bodies", async () => {
  const server = new HttpServer(new Router(), {
    jsonBodyLimitBytes: 4,
    requestTimeoutMs: 100,
    headersTimeoutMs: 80,
    keepAliveTimeoutMs: 60,
    maxRequestsPerSocket: 5,
  });
  const nativeServer = (server as any).server;
  assert.equal(nativeServer.requestTimeout, 100);
  assert.equal(nativeServer.headersTimeout, 80);
  assert.equal(nativeServer.keepAliveTimeout, 60);
  assert.equal(nativeServer.maxRequestsPerSocket, 5);

  const request = Readable.from([Buffer.from("123"), Buffer.from("45")]) as any;
  request.method = "POST";
  request.headers = {
    "content-type": "application/octet-stream",
    "transfer-encoding": "chunked",
  };
  request.destroy = Readable.prototype.destroy.bind(request);

  const body = (await (server as any).parseRequestBody(request)) as Readable;
  await assert.rejects(async () => {
    for await (const _chunk of body) {
      // Consume the bounded stream.
    }
  }, /Payload too large/);
});
