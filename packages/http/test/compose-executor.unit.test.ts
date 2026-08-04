import assert from "node:assert/strict";
import test from "node:test";
import { compose } from "../src/middleware/compose";
import type { RouteDefinition } from "../src/routing/route-definition";
import { HttpExecutor } from "../src/server/http-executor";

test("compose executes middlewares in order around handler", async () => {
  const order: string[] = [];
  const run = compose(
    [
      async (_ctx, next) => {
        order.push("mw1:before");
        const value = await next();
        order.push("mw1:after");
        return value;
      },
      async (_ctx, next) => {
        order.push("mw2:before");
        const value = await next();
        order.push("mw2:after");
        return value;
      },
    ],
    async () => {
      order.push("handler");
      return "done";
    },
  );

  const result = await run({} as any);
  assert.equal(result, "done");
  assert.deepEqual(order, [
    "mw1:before",
    "mw2:before",
    "handler",
    "mw2:after",
    "mw1:after",
  ]);
});

test("compose throws when next is called multiple times", async () => {
  const run = compose(
    [
      async (_ctx, next) => {
        await next();
        return next();
      },
    ],
    async () => "ok",
  );

  await assert.rejects(() => run({} as any), /next\(\) called multiple times/);
});

test("http executor caches route pipeline", async () => {
  const route: RouteDefinition = {
    method: "GET",
    path: "/x",
    handler: async () => "ok",
  };
  const executor = new HttpExecutor();

  const first = executor.createPipeline(route);
  const second = executor.createPipeline(route);
  assert.equal(first, second);

  const result = await executor.execute(route, {} as any);
  assert.equal(result, "ok");
});
