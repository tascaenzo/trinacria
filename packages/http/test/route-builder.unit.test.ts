import assert from "node:assert/strict";
import test from "node:test";
import { RouteBuilder } from "../src/routing/route-builder";

class DemoController {
  value = "ok";

  byName() {
    return this.value;
  }

  byRef() {
    return this.value;
  }
}

test("route builder binds method name handlers to controller instance", async () => {
  const controller = new DemoController();
  const routes = new RouteBuilder(controller).get("/name", "byName").build();

  const result = await routes[0].handler({} as any);
  assert.equal(result, "ok");
  assert.equal(routes[0].handlerName, "byName");
});

test("route builder resolves method reference and keeps handlerName", () => {
  const controller = new DemoController();
  const routes = new RouteBuilder(controller)
    .get("/ref", controller.byRef)
    .build();
  assert.equal(routes[0].handlerName, "byRef");
});

test("route builder accepts route options object with docs/middlewares", () => {
  const controller = new DemoController();
  const mw = async (_ctx: any, next: () => Promise<unknown>) => next();
  const routes = new RouteBuilder(controller)
    .post("/with-options", "byName", {
      middlewares: [mw],
      docs: { summary: "demo" },
    })
    .build();

  assert.equal(routes[0].middlewares?.length, 1);
  assert.equal(routes[0].docs?.summary, "demo");
});

test("route builder throws when handler name is missing on controller", () => {
  const controller = new DemoController();
  assert.throws(
    () => new RouteBuilder(controller).get("/bad", "missing" as never).build(),
    /not a function on controller/,
  );
});

test("route builder accepts middleware list args", () => {
  const controller = new DemoController();
  const mw1 = async (_ctx: any, next: () => Promise<unknown>) => next();
  const mw2 = async (_ctx: any, next: () => Promise<unknown>) => next();

  const routes = new RouteBuilder(controller)
    .get("/with-mw-list", "byName", mw1, mw2)
    .build();

  assert.equal(routes[0].middlewares?.length, 2);
  assert.equal(routes[0].docs, undefined);
});

test("route builder keeps handlerName undefined for external anonymous handler", () => {
  const controller = new DemoController();
  const routes = new RouteBuilder(controller).get("/anon", () => "x").build();

  assert.equal(routes[0].handlerName, undefined);
});
