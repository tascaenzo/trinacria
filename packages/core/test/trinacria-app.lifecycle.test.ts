import test from "node:test";
import assert from "node:assert/strict";
import { TrinacriaApp } from "../src/application/trinacria-app.ts";
import { classProvider } from "../src/di/provider.ts";
import { createToken } from "../src/token/token.ts";
import { defineModule } from "../src/module/module.ts";
import type { ModuleDefinition } from "../src/module/module-definition.ts";
import { definePlugin } from "../src/plugin/plugin.ts";
import type { Plugin } from "../src/plugin/plugin-lifecycle.ts";

test("shutdown destroys imported modules after importers", async () => {
  const order: string[] = [];

  const TOKEN_B = createToken<ServiceB>("TOKEN_B");
  const TOKEN_A = createToken<ServiceA>("TOKEN_A");

  class ServiceB {
    onDestroy() {
      order.push("B");
    }
  }

  class ServiceA {
    constructor(_serviceB: ServiceB) {}

    onDestroy() {
      order.push("A");
    }
  }

  const moduleB = defineModule({
    name: "ModuleB",
    providers: [classProvider(TOKEN_B, ServiceB)],
    exports: [TOKEN_B],
  });

  const moduleA = defineModule({
    name: "ModuleA",
    imports: [moduleB],
    providers: [classProvider(TOKEN_A, ServiceA, [TOKEN_B])],
    exports: [TOKEN_A],
  });

  const app = new TrinacriaApp();
  await app.registerModule(moduleA);
  await app.start();
  await app.shutdown();

  assert.deepEqual(order, ["A", "B"]);
});

test("unregisterModule notifies plugins with the registered module instance", async () => {
  const seen: ModuleDefinition[] = [];

  const plugin = definePlugin({
    name: "capture-unregister",
    onModuleUnregistered(module) {
      seen.push(module);
    },
  });

  const registeredModule = defineModule({
    name: "UsersModule",
  });

  const app = new TrinacriaApp();
  app.use(plugin);
  await app.registerModule(registeredModule);
  await app.start();

  const requestModule = defineModule({
    name: "UsersModule",
  });

  await app.unregisterModule(requestModule);
  await app.shutdown();

  assert.equal(seen.length, 1);
  assert.equal(seen[0], registeredModule);
  assert.notEqual(seen[0], requestModule);
});

test("start/shutdown can be repeated without leaking SIGINT/SIGTERM handlers", async () => {
  const app = new TrinacriaApp();
  const baseSigint = process.listenerCount("SIGINT");
  const baseSigterm = process.listenerCount("SIGTERM");

  await app.start();
  assert.equal(process.listenerCount("SIGINT"), baseSigint + 1);
  assert.equal(process.listenerCount("SIGTERM"), baseSigterm + 1);

  await app.shutdown();
  assert.equal(process.listenerCount("SIGINT"), baseSigint);
  assert.equal(process.listenerCount("SIGTERM"), baseSigterm);

  await app.start();
  assert.equal(process.listenerCount("SIGINT"), baseSigint + 1);
  assert.equal(process.listenerCount("SIGTERM"), baseSigterm + 1);

  await app.shutdown();
  assert.equal(process.listenerCount("SIGINT"), baseSigint);
  assert.equal(process.listenerCount("SIGTERM"), baseSigterm);
});

test("runtime module registration rolls back if a plugin hook fails", async () => {
  const TOKEN = createToken<{ value: number }>("RUNTIME_TOKEN");
  const plugin: Plugin = definePlugin({
    name: "failing-runtime-plugin",
    onModuleRegistered() {
      throw new Error("hook failure");
    },
  });

  const runtimeModule = defineModule({
    name: "RuntimeModule",
    providers: [classProvider(TOKEN, class RuntimeService {})],
    exports: [TOKEN],
  });

  const app = new TrinacriaApp();
  app.use(plugin);
  await app.start();

  await assert.rejects(() => app.registerModule(runtimeModule), /hook failure/);

  assert.equal(app.isModuleRegistered(runtimeModule), false);
  assert.equal(app.hasToken(TOKEN), false);

  await app.shutdown();
});
