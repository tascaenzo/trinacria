import assert from "node:assert/strict";
import test from "node:test";
import { Container } from "../src/di/container.ts";
import { factoryProvider, valueProvider } from "../src/di/provider.ts";
import { createToken } from "../src/token/token.ts";

test("concurrent resolve shares the same in-flight singleton promise", async () => {
  const container = new Container();
  const TOKEN = createToken<{ id: number }>("CONCURRENT_TOKEN");
  let calls = 0;

  container.register(
    factoryProvider(TOKEN, async () => {
      calls += 1;
      await delay(15);
      return { id: calls };
    }),
  );

  await container.init();

  const [a, b, c] = await Promise.all([
    container.resolve(TOKEN),
    container.resolve(TOKEN),
    container.resolve(TOKEN),
  ]);

  assert.equal(calls, 1);
  assert.equal(a, b);
  assert.equal(b, c);
});

test("concurrent init calls instantiate providers only once", async () => {
  const container = new Container();
  const TOKEN = createToken<number>("INIT_ONCE");
  let calls = 0;

  container.register(
    factoryProvider(TOKEN, async () => {
      calls += 1;
      await delay(10);
      return 99;
    }),
  );

  await Promise.all([container.init(), container.init(), container.init()]);
  assert.equal(calls, 1);
});

test("external lifecycle skips onInit/onDestroy hooks", async () => {
  const container = new Container();
  const TOKEN = createToken<{
    onInit: () => void;
    onDestroy: () => void;
  }>("EXTERNAL_LIFECYCLE");

  let initCalls = 0;
  let destroyCalls = 0;

  container.register({
    ...valueProvider(TOKEN, {
      onInit() {
        initCalls += 1;
      },
      onDestroy() {
        destroyCalls += 1;
      },
    }),
    lifecycle: "external",
  });

  await container.init();
  await container.resolve(TOKEN);
  await container.destroy();

  assert.equal(initCalls, 0);
  assert.equal(destroyCalls, 0);
});

test("unregisterAndDestroy removes provider even when onDestroy throws", async () => {
  const container = new Container();
  const TOKEN = createToken<{ onDestroy: () => void }>("UNREGISTER_DESTROY");

  container.register(
    valueProvider(TOKEN, {
      onDestroy() {
        throw new Error("destroy failure");
      },
    }),
  );

  await container.init();
  await container.resolve(TOKEN);

  await container.unregisterAndDestroy(TOKEN, true);
  assert.equal(container.has(TOKEN), false);
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
