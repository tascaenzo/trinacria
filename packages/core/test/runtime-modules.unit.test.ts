import test from "node:test";
import assert from "node:assert/strict";
import { TrinacriaApp } from "../src/application/trinacria-app.ts";
import { classProvider } from "../src/di/provider.ts";
import { createProviderKind } from "../src/di/provider-kind.ts";
import { createToken } from "../src/token/token.ts";
import { defineModule } from "../src/module/module.ts";
import { definePlugin } from "../src/plugin/plugin.ts";
import { ModuleRegistrationError } from "../src/errors/core-errors.ts";

test("runtime register rollback compensates already-notified plugins in reverse order", async () => {
  const calls: string[] = [];
  const TOKEN = createToken<{ value: number }>("ROLLBACK_RUNTIME");
  const runtimeModule = defineModule({
    name: "RuntimeRollbackModule",
    providers: [classProvider(TOKEN, class RuntimeService {})],
    exports: [TOKEN],
  });

  const pluginA = definePlugin({
    name: "plugin-A",
    onModuleRegistered() {
      calls.push("A:registered");
    },
    onModuleUnregistered() {
      calls.push("A:unregistered");
    },
  });

  const pluginB = definePlugin({
    name: "plugin-B",
    onModuleRegistered() {
      calls.push("B:registered");
      throw new Error("plugin B fails on register");
    },
    onModuleUnregistered() {
      calls.push("B:unregistered");
    },
  });

  const app = new TrinacriaApp();
  app.use(pluginA).use(pluginB);
  await app.start();

  await assert.rejects(
    () => app.registerModule(runtimeModule),
    ModuleRegistrationError,
  );

  assert.deepEqual(calls, ["A:registered", "B:registered", "A:unregistered"]);
  assert.equal(app.isModuleRegistered(runtimeModule), false);
  assert.equal(app.hasToken(TOKEN), false);

  await app.shutdown();
});

test("runtime unregister removes token visibility and provider kind index", async () => {
  const kind = createProviderKind<{ id: string }>("RUNTIME_KIND");
  const TOKEN = createToken<{ id: string }>("RUNTIME_KIND_TOKEN");

  class RuntimeService {
    readonly id = "runtime";
  }

  const runtimeModule = defineModule({
    name: "RuntimeKindModule",
    providers: [classProvider(TOKEN, RuntimeService, undefined, kind)],
    exports: [TOKEN],
  });

  const app = new TrinacriaApp();
  await app.start();
  await app.registerModule(runtimeModule);

  assert.equal(app.hasToken(TOKEN), true);
  assert.equal(app.getProvidersByKind(kind).length, 1);

  await app.unregisterModule(runtimeModule);

  assert.equal(app.hasToken(TOKEN), false);
  assert.equal(app.getProvidersByKind(kind).length, 0);
  assert.equal(app.describeGraph().modules.length, 0);

  await app.shutdown();
});

test("registerModule rejects duplicate module names at runtime", async () => {
  const TOKEN = createToken<number>("DUP_TOKEN");
  const first = defineModule({
    name: "DuplicateRuntimeModule",
    providers: [classProvider(TOKEN, class One {})],
    exports: [TOKEN],
  });
  const second = defineModule({
    name: "DuplicateRuntimeModule",
    providers: [classProvider(TOKEN, class Two {})],
    exports: [TOKEN],
  });

  const app = new TrinacriaApp();
  await app.registerModule(first);
  await app.start();

  await assert.rejects(
    () => app.registerModule(second),
    ModuleRegistrationError,
  );

  await app.shutdown();
});

test("unregisterModule ignores unknown module names", async () => {
  const app = new TrinacriaApp();
  await app.start();

  await app.unregisterModule(
    defineModule({
      name: "UnknownModule",
    }),
  );

  assert.deepEqual(app.listModules(), []);
  await app.shutdown();
});
