import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { Router } from "../src/routing/router";
import { HttpServer } from "../src/server/http-server";
import type { RouteDefinition } from "../src/routing/route-definition";

interface RequestResult {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

function withSilencedOutput<T>(run: () => Promise<T> | T): Promise<T> {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  (process.stdout as any).write = () => true;
  (process.stderr as any).write = () => true;

  return Promise.resolve()
    .then(() => run())
    .finally(() => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
      (process.stdout as any).write = originalStdoutWrite;
      (process.stderr as any).write = originalStderrWrite;
    });
}

function requestOnce(
  port: number,
  options: {
    method?: string;
    path: string;
    headers?: Record<string, string>;
    body?: string;
  },
): Promise<RequestResult> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method: options.method ?? "GET",
        path: options.path,
        headers: options.headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );

    req.on("error", reject);
    if (options.body !== undefined) {
      req.write(options.body);
    }
    req.end();
  });
}

async function withServer(
  routes: RouteDefinition[],
  run: (port: number) => Promise<void>,
  options?: ConstructorParameters<typeof HttpServer>[1],
): Promise<void> {
  const router = new Router();
  for (const r of routes) {
    router.register(r);
  }

  const server = new HttpServer(router, options);
  await server.listen(0, "127.0.0.1");
  const port = ((server as any).server.address() as { port: number }).port;

  try {
    await run(port);
  } finally {
    await server.close();
  }
}

test("http server returns 404 for unknown route and 405 for wrong method", async () => {
  await withSilencedOutput(() =>
    withServer(
      [
        {
          method: "GET",
          path: "/ok",
          handler: () => ({ ok: true }),
        },
      ],
      async (port) => {
        const notFound = await requestOnce(port, { path: "/missing" });
        assert.equal(notFound.status, 404);

        const methodNotAllowed = await requestOnce(port, {
          method: "POST",
          path: "/ok",
        });
        assert.equal(methodNotAllowed.status, 405);
        assert.equal(methodNotAllowed.headers.allow, "GET");
      },
    ),
  );
});

test("http server parses JSON body and route params/query", async () => {
  await withSilencedOutput(() =>
    withServer(
      [
        {
          method: "POST",
          path: "/users/:id",
          handler: (ctx) => ({
            id: ctx.params.id,
            q: ctx.query.q,
            body: ctx.body,
          }),
        },
      ],
      async (port) => {
        const result = await requestOnce(port, {
          method: "POST",
          path: "/users/42?q=test",
          headers: {
            "content-type": "application/json",
            "content-length": String(Buffer.byteLength('{"name":"enzo"}')),
          },
          body: '{"name":"enzo"}',
        });

        assert.equal(result.status, 200);
        const parsed = JSON.parse(result.body);
        assert.equal(parsed.id, "42");
        assert.equal(parsed.q, "test");
        assert.deepEqual(parsed.body, { name: "enzo" });
      },
    ),
  );
});

test("http server returns 400 on invalid JSON", async () => {
  await withSilencedOutput(() =>
    withServer(
      [
        {
          method: "POST",
          path: "/json",
          handler: (ctx) => ctx.body,
        },
      ],
      async (port) => {
        const result = await requestOnce(port, {
          method: "POST",
          path: "/json",
          headers: {
            "content-type": "application/json",
            "content-length": String(Buffer.byteLength("{invalid")),
          },
          body: "{invalid",
        });

        assert.equal(result.status, 400);
        const parsed = JSON.parse(result.body);
        assert.equal(parsed.code, "INVALID_JSON_BODY");
      },
    ),
  );
});

test("http server enforces payload limit and close is idempotent", async () => {
  await withSilencedOutput(async () => {
    const router = new Router();
    router.register({
      method: "POST",
      path: "/upload",
      handler: () => "ok",
    });

    const server = new HttpServer(router, { jsonBodyLimitBytes: 2 });
    await server.listen(0, "127.0.0.1");
    const port = ((server as any).server.address() as { port: number }).port;

    try {
      try {
        const result = await requestOnce(port, {
          method: "POST",
          path: "/upload",
          headers: {
            "content-type": "application/json",
            "content-length": "7",
          },
          body: '{"x":1}',
        });

        assert.equal(result.status, 413);
        const parsed = JSON.parse(result.body);
        assert.equal(parsed.code, "PAYLOAD_TOO_LARGE");
      } catch (error: any) {
        // Some Node versions close the socket immediately after destroying req.
        assert.equal(error?.code, "ECONNRESET");
      }
    } finally {
      await Promise.all([server.close(), server.close()]);
    }
  });
});
