import assert from "node:assert/strict";
import test from "node:test";
import { Container } from "../src/di/container.ts";
import {
  classProvider,
  factoryProvider,
  valueProvider,
} from "../src/di/provider.ts";
import {
  CircularDependencyError,
  ContainerStateError,
} from "../src/errors/core-errors.ts";
import { createToken } from "../src/token/token.ts";

test("container rejects resolve before init", async () => {
  const container = new Container();
  const TOKEN = createToken<number>("NUMBER_TOKEN");
  container.register(valueProvider(TOKEN, 10));

  await assert.rejects(() => container.resolve(TOKEN), ContainerStateError);
});

test("container detects circular dependencies during init", async () => {
  const container = new Container();
  const TOKEN_A = createToken<ServiceA>("TOKEN_A");
  const TOKEN_B = createToken<ServiceB>("TOKEN_B");

  class ServiceA {
    constructor(_b: ServiceB) {}
  }

  class ServiceB {
    constructor(_a: ServiceA) {}
  }

  container.register(classProvider(TOKEN_A, ServiceA, [TOKEN_B]));
  container.register(classProvider(TOKEN_B, ServiceB, [TOKEN_A]));

  await assert.rejects(() => container.init(), CircularDependencyError);
});

test("container honors lazy providers (eager: false)", async () => {
  const container = new Container();
  const TOKEN = createToken<number>("LAZY_NUMBER");
  let invocations = 0;

  container.register({
    ...factoryProvider(TOKEN, () => {
      invocations += 1;
      return 7;
    }),
    eager: false,
  });

  await container.init();
  assert.equal(invocations, 0);

  const resolved = await container.resolve(TOKEN);
  assert.equal(resolved, 7);
  assert.equal(invocations, 1);
});

test("container retries failed lazy instantiation on next resolve", async () => {
  const container = new Container();
  const TOKEN = createToken<number>("RETRY_TOKEN");
  let attempts = 0;

  container.register({
    ...factoryProvider(TOKEN, () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("first attempt fails");
      }
      return 42;
    }),
    eager: false,
  });

  await container.init();

  await assert.rejects(() => container.resolve(TOKEN), /first attempt fails/);
  const resolved = await container.resolve(TOKEN);

  assert.equal(resolved, 42);
  assert.equal(attempts, 2);
});

test("container destroy aggregates onDestroy errors", async () => {
  const container = new Container();
  const TOKEN_A = createToken<{ onDestroy: () => void }>("DESTROY_A");
  const TOKEN_B = createToken<{ onDestroy: () => void }>("DESTROY_B");

  container.register(
    valueProvider(TOKEN_A, {
      onDestroy() {
        throw new Error("destroy A failed");
      },
    }),
  );

  container.register(
    valueProvider(TOKEN_B, {
      onDestroy() {
        throw new Error("destroy B failed");
      },
    }),
  );

  await container.init();

  await assert.rejects(
    async () => {
      await container.destroy();
    },
    (error: unknown) => {
      if (!(error instanceof AggregateError)) return false;
      return (
        error.errors.length === 2 &&
        String(error.errors[0]).includes("destroy") &&
        String(error.errors[1]).includes("destroy")
      );
    },
  );
});
