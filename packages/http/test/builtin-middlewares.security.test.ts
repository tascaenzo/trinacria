import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import {
  cors,
  createMemoryRateLimitStore,
  createSecurityHeadersBuilder,
  rateLimit,
} from "../src/builtin-middlewares";
import { Router } from "../src/routing";
import { HttpServer } from "../src/server/http-server";

function createContext(
  options: {
    origin?: string;
    method?: string;
    remoteAddress?: string;
    forwardedFor?: string;
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
