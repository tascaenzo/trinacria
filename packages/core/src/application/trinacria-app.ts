import { ModuleRegistry } from "../module/module-registry";
import type { ModuleDefinition } from "../module/module-definition";
import type { Plugin } from "../plugin/plugin-lifecycle";
import type { ApplicationContext } from "./application-context";
import type { Token } from "../token";
import type { Provider } from "../di/provider-types";
import type { ProviderKind } from "../di/provider-kind";
import { ApplicationBuilder } from "./application-builder";
import { CoreLog } from "../logger/core-logger";

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
      throw new Error("Cannot register plugin after start.");
    }

    CoreLog.debug(`[Trinacria] Plugin registered: ${plugin.name}`);

    this.plugins.push(plugin);
    return this;
  }

  async registerModule(module: ModuleDefinition): Promise<void> {
    if (!this.started) {
      CoreLog.debug(
        `[Trinacria] Module registered (config phase): ${module.name}`,
      );

      this.modules.push(module);
      return;
    }

    // runtime dinamico
    CoreLog.info(`[Trinacria] Module registered at runtime: ${module.name}`);

    this.registry.build(module);
    await this.registry.init();

    for (const plugin of this.plugins) {
      await plugin.onModuleRegistered?.(module, this);
    }
  }

  async unregisterModule(module: ModuleDefinition): Promise<void> {
    CoreLog.warn(`[Trinacria] Module unregistered: ${module.name}`);

    // TODO: implementare reale rimozione nel registry

    for (const plugin of this.plugins) {
      await plugin.onModuleUnregistered?.(module, this);
    }
  }

  registerGlobalProvider(provider: Provider): void {
    if (this.started) {
      throw new Error("Cannot register global provider after start.");
    }

    CoreLog.debug(
      `[Trinacria] Global provider registered: ${provider.token.description ?? provider.token.key.toString()}`,
    );

    this.registry.getRootContainer().register(provider);
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

    // 1️⃣ plugin onRegister
    for (const plugin of this.plugins) {
      CoreLog.debug(`[Trinacria] Plugin onRegister: ${plugin.name}`);
      await plugin.onRegister?.(this);
    }

    // 2️⃣ build moduli
    for (const module of this.modules) {
      CoreLog.debug(`[Trinacria] Building module: ${module.name}`);
      this.registry.build(module);
    }

    // 3️⃣ init container eager
    CoreLog.info("[Trinacria] Initializing containers...");
    await this.registry.init();

    // 4️⃣ plugin onInit
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

  private setupSignalHandlers() {
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
