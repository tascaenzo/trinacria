import { ModuleRegistry } from "../module/module-registry";
import type { ModuleDefinition } from "../module/module-definition";
import type { Plugin } from "../plugin/plugin-lifecycle";
import type { ApplicationContext } from "./application-context";
import type { Token } from "../token";
import type { Provider } from "../di/provider-types";
import type { ProviderKind } from "../di/provider-kind";
import { ApplicationBuilder } from "./application-builder";
import { CoreLog } from "../logger/core-logger";
import {
  ApplicationStateError,
  ModuleRegistrationError,
  ModuleRegistrationRollbackError,
  ModuleUnregistrationError,
} from "../errors";
import type { ModuleGraphSnapshot } from "../module";

/**
 * Main orchestrator for Trinacria runtime lifecycle.
 * It coordinates plugin hooks, module registration, container bootstrap, and shutdown.
 */
export class TrinacriaApp implements ApplicationContext, ApplicationBuilder {
  private readonly registry = new ModuleRegistry();
  private readonly plugins: Plugin[] = [];
  private readonly modules: ModuleDefinition[] = [];

  private started = false;

  // --------------------------------------------------
  // CONFIGURATION PHASE
  // --------------------------------------------------

  use(plugin: Plugin): this {
    if (this.started) {
      throw new ApplicationStateError("Cannot register plugin after start.");
    }

    CoreLog.debug(`[Trinacria] Plugin registered: ${plugin.name}`);

    this.plugins.push(plugin);
    return this;
  }

  async registerModule(module: ModuleDefinition): Promise<void> {
    if (this.isModuleRegistered(module)) {
      throw new ModuleRegistrationError(
        `Module "${module.name}" is already registered.`,
      );
    }

    if (!this.started) {
      CoreLog.debug(
        `[Trinacria] Module registered (config phase): ${module.name}`,
      );

      this.modules.push(module);
      return;
    }

    // Runtime path: build and initialize the new module immediately.
    CoreLog.info(`[Trinacria] Module registered at runtime: ${module.name}`);

    const notifiedPlugins: Plugin[] = [];
    this.modules.push(module);
    try {
      this.registry.build(module);
      await this.registry.init();

      for (const plugin of this.plugins) {
        await plugin.onModuleRegistered?.(module, this);
        notifiedPlugins.push(plugin);
      }
    } catch (error) {
      await this.rollbackRuntimeModuleRegistration(module, notifiedPlugins, error);
    }
  }

  async unregisterModule(module: ModuleDefinition): Promise<void> {
    CoreLog.warn(`[Trinacria] Module unregistered: ${module.name}`);

    if (!this.started) {
      const index = this.modules.findIndex((item) => item.name === module.name);
      if (index !== -1) {
        this.modules.splice(index, 1);
      }
      return;
    }

    await this.registry.unregister(module);

    const index = this.modules.findIndex((item) => item.name === module.name);
    if (index !== -1) {
      this.modules.splice(index, 1);
    }

    const hookErrors: unknown[] = [];
    for (const plugin of this.plugins) {
      try {
        await plugin.onModuleUnregistered?.(module, this);
      } catch (error) {
        hookErrors.push(error);
      }
    }

    if (hookErrors.length > 0) {
      const details = hookErrors.map((error) => toErrorMessage(error)).join("; ");
      throw new ModuleUnregistrationError(
        `Module "${module.name}" was unregistered but one or more plugin hooks failed: ${details}`,
      );
    }
  }

  registerGlobalProvider(provider: Provider): void {
    if (this.started) {
      throw new ApplicationStateError(
        "Cannot register global provider after start.",
      );
    }

    CoreLog.debug(
      `[Trinacria] Global provider registered: ${provider.token.description ?? provider.token.key.toString()}`,
    );

    this.registry.registerGlobalProvider(provider);
  }

  // --------------------------------------------------
  // BOOTSTRAP
  // --------------------------------------------------

  async start(): Promise<void> {
    if (this.started) return;

    CoreLog.info("[Trinacria] Starting application...");

    CoreLog.debug(
      `[Trinacria] Modules: ${this.modules.length}, Plugins: ${this.plugins.length}`,
    );

    // 1) Let plugins run pre-build registration hooks.
    for (const plugin of this.plugins) {
      CoreLog.debug(`[Trinacria] Plugin onRegister: ${plugin.name}`);
      await plugin.onRegister?.(this);
    }

    // 2) Build module graphs and register exported providers.
    for (const module of this.modules) {
      CoreLog.debug(`[Trinacria] Building module: ${module.name}`);
      this.registry.build(module);
    }

    // 3) Eagerly initialize all containers/providers.
    CoreLog.info("[Trinacria] Initializing containers...");
    await this.registry.init();

    // 4) Let plugins run post-init hooks.
    for (const plugin of this.plugins) {
      CoreLog.debug(`[Trinacria] Plugin onInit: ${plugin.name}`);
      await plugin.onInit?.(this);
    }

    this.started = true;
    this.setupSignalHandlers();

    CoreLog.info("[Trinacria] Application started successfully.");
  }

  async shutdown(): Promise<void> {
    if (!this.started) return;

    CoreLog.info("[Trinacria] Shutting down application...");

    for (const plugin of this.plugins) {
      CoreLog.debug(`[Trinacria] Plugin onDestroy: ${plugin.name}`);
      await plugin.onDestroy?.(this);
    }

    await this.registry.destroy();

    this.started = false;

    CoreLog.info("[Trinacria] Application shutdown complete.");
  }

  // --------------------------------------------------
  // ApplicationContext API
  // --------------------------------------------------

  async resolve<T>(token: Token<T>): Promise<T> {
    return this.registry.getRootContainer().resolve(token);
  }

  getProvidersByKind<T>(kind: ProviderKind<T>): Provider<T>[] {
    return this.registry.getProvidersByKind(kind);
  }

  isModuleRegistered(module: ModuleDefinition): boolean {
    return this.modules.some((item) => item.name === module.name);
  }

  listModules(): string[] {
    return this.modules.map((item) => item.name);
  }

  hasToken<T>(token: Token<T>): boolean {
    return this.registry.getRootContainer().has(token);
  }

  describeGraph(): ModuleGraphSnapshot {
    return this.registry.describeGraph();
  }

  private async rollbackRuntimeModuleRegistration(
    module: ModuleDefinition,
    notifiedPlugins: Plugin[],
    registrationError: unknown,
  ): Promise<never> {
    const rollbackErrors: unknown[] = [];

    // Compensate plugins that already received onModuleRegistered.
    for (const plugin of [...notifiedPlugins].reverse()) {
      try {
        await plugin.onModuleUnregistered?.(module, this);
      } catch (error) {
        rollbackErrors.push(
          new ModuleRegistrationRollbackError(
            `Plugin "${plugin.name}" rollback failed: ${toErrorMessage(error)}`,
          ),
        );
      }
    }

    // Roll back module graph/container state.
    try {
      await this.registry.unregister(module);
    } catch (error) {
      rollbackErrors.push(
        new ModuleRegistrationRollbackError(
          `Registry rollback failed: ${toErrorMessage(error)}`,
        ),
      );
    }

    const index = this.modules.findIndex((item) => item.name === module.name);
    if (index !== -1) {
      this.modules.splice(index, 1);
    }

    if (rollbackErrors.length > 0) {
      throw new ModuleRegistrationError(
        `Failed to register module "${module.name}" and rollback completed with errors. Registration error: ${toErrorMessage(registrationError)}. Rollback errors: ${rollbackErrors
          .map((item) => toErrorMessage(item))
          .join("; ")}`,
      );
    }

    throw new ModuleRegistrationError(
      `Failed to register module "${module.name}" at runtime. Changes were rolled back: ${toErrorMessage(registrationError)}`,
    );
  }

  private setupSignalHandlers() {
    // Forward process termination signals to graceful shutdown.
    const handleSignal = async (signal: NodeJS.Signals) => {
      CoreLog.warn(
        `[Trinacria] Received ${signal}. Starting graceful shutdown...`,
      );

      try {
        await this.shutdown();
        process.exit(0);
      } catch (err) {
        CoreLog.error("[Trinacria] Error during shutdown", err);
        process.exit(1);
      }
    };

    process.once("SIGTERM", () => handleSignal("SIGTERM"));
    process.once("SIGINT", () => handleSignal("SIGINT"));
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
