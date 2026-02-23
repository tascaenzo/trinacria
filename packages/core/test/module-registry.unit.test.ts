import test from "node:test";
import assert from "node:assert/strict";
import { ModuleRegistry } from "../src/module/module-registry.ts";
import { classProvider, valueProvider } from "../src/di/provider.ts";
import { createToken } from "../src/token/token.ts";
import { defineModule } from "../src/module/module.ts";
import {
  ModuleDependencyError,
  ModuleUnregistrationError,
  TokenConflictError,
} from "../src/errors/core-errors.ts";

test("module registry wraps provider destroy failures during unregister", async () => {
  const TOKEN = createToken<BrokenService>("BROKEN_SERVICE");

  class BrokenService {
    onDestroy() {
      throw new Error("destroy boom");
    }
  }

  const module = defineModule({
    name: "BrokenModule",
    providers: [classProvider(TOKEN, BrokenService)],
    exports: [TOKEN],
  });

  const registry = new ModuleRegistry();
  registry.build(module);
  await registry.init();

  await assert.rejects(
    () => registry.unregister(module),
    ModuleUnregistrationError,
  );
});

test("module registry handles token conflicts and import-link cleanup on unregister", async () => {
  const CONFLICT = createToken<number>("CONFLICT_TOKEN");
  const registryConflict = new ModuleRegistry();
  registryConflict.registerGlobalProvider(valueProvider(CONFLICT, 1));

  const conflictModule = defineModule({
    name: "ConflictModule",
    providers: [valueProvider(CONFLICT, 2)],
    exports: [CONFLICT],
  });

  assert.throws(() => registryConflict.build(conflictModule), TokenConflictError);

  const TOKEN_BASE = createToken<BaseService>("BASE_TOKEN");
  const TOKEN_FEATURE = createToken<FeatureService>("FEATURE_TOKEN");

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

  const registry = new ModuleRegistry();
  registry.build(featureModule);
  await registry.init();

  await assert.rejects(
    () => registry.unregister(baseModule),
    ModuleDependencyError,
  );

  await registry.unregister(featureModule);
  await registry.unregister(baseModule);
  await registry.destroy();
});
