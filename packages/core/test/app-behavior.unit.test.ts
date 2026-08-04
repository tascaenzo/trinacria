import assert from "node:assert/strict";
import test from "node:test";
import { TrinacriaApp } from "../src/application/trinacria-app.ts";
import { classProvider, valueProvider } from "../src/di/provider.ts";
import { createProviderKind } from "../src/di/provider-kind.ts";
import {
  ApplicationStateError,
  ModuleUnregistrationError,
  ProviderNotFoundError,
} from "../src/errors/core-errors.ts";
import { defineModule } from "../src/module/module.ts";
import { definePlugin } from "../src/plugin/plugin.ts";
import { createToken } from "../src/token/token.ts";

test("describeGraph returns modules sorted by name and providerKinds counts", async () => {
  const kind = createProviderKind<{ id: string }>("HTTP_KIND");
  const GLOBAL = createToken<{ id: string }>("GLOBAL_KIND_TOKEN");
  const BETA = createToken<{ id: string }>("BETA_TOKEN");
  const ALPHA = createToken<{ id: string }>("ALPHA_TOKEN");

  class AlphaService {
    readonly id = "alpha";
  }

  class BetaService {
    readonly id = "beta";
  }

  const betaModule = defineModule({
    name: "BetaModule",
    providers: [classProvider(BETA, BetaService, undefined, kind)],
    exports: [BETA],
  });

  const alphaModule = defineModule({
    name: "AlphaModule",
    providers: [classProvider(ALPHA, AlphaService, undefined, kind)],
    exports: [ALPHA],
  });

  const app = new TrinacriaApp();
  app.registerGlobalProvider(valueProvider(GLOBAL, { id: "global" }, kind));
  await app.registerModule(betaModule);
  await app.registerModule(alphaModule);
  await app.start();

  const graph = app.describeGraph();
  assert.deepEqual(
    graph.modules.map((module) => module.name),
    ["AlphaModule", "BetaModule"],
  );
  assert.equal(graph.providerKinds[kind.key.toString()], 3);

  await app.shutdown();
});

test("getProvidersByKind includes global and module providers", async () => {
  const kind = createProviderKind<{ source: string }>("DISCOVERY_KIND");
  const GLOBAL = createToken<{ source: string }>("GLOBAL_DISCOVERY");
  const MODULE = createToken<{ source: string }>("MODULE_DISCOVERY");

  class ModuleService {
    readonly source = "module";
  }

  const module = defineModule({
    name: "DiscoveryModule",
    providers: [classProvider(MODULE, ModuleService, undefined, kind)],
    exports: [MODULE],
  });

  const app = new TrinacriaApp();
  app.registerGlobalProvider(valueProvider(GLOBAL, { source: "global" }, kind));
  await app.registerModule(module);
  await app.start();

  const providers = app.getProvidersByKind(kind);
  const keys = new Set(providers.map((provider) => provider.token.key));
  assert.equal(providers.length, 2);
  assert.equal(keys.has(GLOBAL.key), true);
  assert.equal(keys.has(MODULE.key), true);

  await app.shutdown();
});

test("failed startup cannot be retried on the same app instance", async () => {
  const app = new TrinacriaApp();
  app.use(
    definePlugin({
      name: "failing-init-plugin",
      onInit() {
        throw new Error("init failed");
      },
    }),
  );

  await assert.rejects(() => app.start(), /init failed/);
  await assert.rejects(() => app.start(), ApplicationStateError);
});

test("use() throws when called after app start", async () => {
  const app = new TrinacriaApp();
  await app.start();

  assert.throws(
    () =>
      app.use(
        definePlugin({
          name: "late-plugin",
        }),
      ),
    ApplicationStateError,
  );

  await app.shutdown();
});

test("unregisterModule keeps module removed even if plugin hook fails", async () => {
  const TOKEN = createToken<{ v: number }>("UNREGISTER_TOKEN");
  const module = defineModule({
    name: "UnregisterTarget",
    providers: [valueProvider(TOKEN, { v: 1 })],
    exports: [TOKEN],
  });

  const app = new TrinacriaApp();
  app.use(
    definePlugin({
      name: "failing-unregister-hook",
      onModuleUnregistered() {
        throw new Error("plugin unregister failed");
      },
    }),
  );

  await app.registerModule(module);
  await app.start();

  await assert.rejects(
    () => app.unregisterModule(module),
    ModuleUnregistrationError,
  );

  assert.equal(app.isModuleRegistered(module), false);
  assert.equal(app.hasToken(TOKEN), false);
  await assert.rejects(() => app.resolve(TOKEN), ProviderNotFoundError);

  await app.shutdown();
});

test("shutdown errors do not prevent future start attempts", async () => {
  const app = new TrinacriaApp();
  app.use(
    definePlugin({
      name: "failing-destroy-plugin",
      onDestroy() {
        throw new Error("destroy failed");
      },
    }),
  );

  await app.start();
  await assert.rejects(async () => {
    await app.shutdown();
  }, AggregateError);

  await app.start();
  await assert.rejects(async () => {
    await app.shutdown();
  }, AggregateError);
});

test("shutdown aggregates plugin and registry errors while keeping state reusable", async () => {
  const TOKEN = createToken<{ onDestroy: () => void }>("SHUTDOWN_AGGREGATE");
  const module = defineModule({
    name: "ShutdownAggregateModule",
    providers: [
      valueProvider(TOKEN, {
        onDestroy() {
          throw new Error("provider destroy failed");
        },
      }),
    ],
    exports: [TOKEN],
  });

  const app = new TrinacriaApp();
  let destroyCalls = 0;
  app.use(
    definePlugin({
      name: "failing-shutdown-plugin",
      onDestroy() {
        destroyCalls += 1;
        if (destroyCalls === 1) {
          throw new Error("plugin destroy failed");
        }
      },
    }),
  );
  await app.registerModule(module);
  await app.start();

  assert.equal(app.isModuleRegistered(module), true);
  assert.deepEqual(app.listModules(), ["ShutdownAggregateModule"]);
  assert.equal(app.hasToken(TOKEN), true);
  assert.equal(app.describeGraph().modules.length, 1);

  await assert.rejects(async () => {
    await app.shutdown();
  }, AggregateError);

  app.registerGlobalProvider(valueProvider(createToken("AFTER_SHUTDOWN"), 1));
  await app.start();
  await assert.rejects(async () => {
    await app.shutdown();
  }, AggregateError);
});
