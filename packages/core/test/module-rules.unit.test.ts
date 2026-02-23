import test from "node:test";
import assert from "node:assert/strict";
import { TrinacriaApp } from "../src/application/trinacria-app.ts";
import { classProvider, valueProvider } from "../src/di/provider.ts";
import { createToken } from "../src/token/token.ts";
import { defineModule } from "../src/module/module.ts";
import {
  ApplicationStateError,
  ModuleDependencyError,
  TokenConflictError,
} from "../src/errors/core-errors.ts";

test("start fails when two modules export the same token", async () => {
  const SHARED = createToken<{ name: string }>("SHARED");

  class ServiceOne {
    readonly name = "one";
  }

  class ServiceTwo {
    readonly name = "two";
  }

  const moduleOne = defineModule({
    name: "ModuleOne",
    providers: [classProvider(SHARED, ServiceOne)],
    exports: [SHARED],
  });

  const moduleTwo = defineModule({
    name: "ModuleTwo",
    providers: [classProvider(SHARED, ServiceTwo)],
    exports: [SHARED],
  });

  const app = new TrinacriaApp();
  await app.registerModule(moduleOne);
  await app.registerModule(moduleTwo);

  await assert.rejects(() => app.start(), TokenConflictError);
});

test("start fails when module depends on token not exported by imported module", async () => {
  const INTERNAL = createToken<ServiceInternal>("INTERNAL");
  const CONSUMER = createToken<ServiceConsumer>("CONSUMER");

  class ServiceInternal {}
  class ServiceConsumer {
    constructor(_internal: ServiceInternal) {}
  }

  const moduleInternal = defineModule({
    name: "InternalModule",
    providers: [classProvider(INTERNAL, ServiceInternal)],
  });

  const moduleConsumer = defineModule({
    name: "ConsumerModule",
    imports: [moduleInternal],
    providers: [classProvider(CONSUMER, ServiceConsumer, [INTERNAL])],
    exports: [CONSUMER],
  });

  const app = new TrinacriaApp();
  await app.registerModule(moduleConsumer);

  await assert.rejects(() => app.start(), ModuleDependencyError);
});

test("cannot unregister a module while another module imports it", async () => {
  const TOKEN_BASE = createToken<BaseService>("TOKEN_BASE");
  const TOKEN_FEATURE = createToken<FeatureService>("TOKEN_FEATURE");

  class BaseService {}
  class FeatureService {
    constructor(_base: BaseService) {}
  }

  const baseModule = defineModule({
    name: "BaseModule",
    providers: [classProvider(TOKEN_BASE, BaseService)],
    exports: [TOKEN_BASE],
  });

  const featureModule = defineModule({
    name: "FeatureModule",
    imports: [baseModule],
    providers: [classProvider(TOKEN_FEATURE, FeatureService, [TOKEN_BASE])],
    exports: [TOKEN_FEATURE],
  });

  const app = new TrinacriaApp();
  await app.registerModule(baseModule);
  await app.registerModule(featureModule);
  await app.start();

  await assert.rejects(
    () => app.unregisterModule(baseModule),
    ModuleDependencyError,
  );

  assert.equal(app.isModuleRegistered(baseModule), true);
  assert.equal(app.isModuleRegistered(featureModule), true);

  await app.shutdown();
});

test("global providers are visible in modules without explicit imports", async () => {
  const CONFIG = createToken<{ env: string }>("CONFIG");
  const SERVICE = createToken<Service>("SERVICE");

  class Service {
    constructor(readonly config: { env: string }) {}
  }

  const serviceModule = defineModule({
    name: "ServiceModule",
    providers: [classProvider(SERVICE, Service, [CONFIG])],
    exports: [SERVICE],
  });

  const app = new TrinacriaApp();
  app.registerGlobalProvider(valueProvider(CONFIG, { env: "test" }));
  await app.registerModule(serviceModule);
  await app.start();

  const service = await app.resolve(SERVICE);
  assert.equal(service.config.env, "test");

  await app.shutdown();
});

test("registerGlobalProvider fails after app start", async () => {
  const CONFIG = createToken<{ env: string }>("CONFIG_AFTER_START");
  const app = new TrinacriaApp();

  await app.start();

  assert.throws(
    () => app.registerGlobalProvider(valueProvider(CONFIG, { env: "prod" })),
    ApplicationStateError,
  );

  await app.shutdown();
});
