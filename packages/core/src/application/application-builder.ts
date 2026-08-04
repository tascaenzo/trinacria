import type { Provider } from "../di/provider-types";
import type { ModuleDefinition } from "../module/module-definition";
import type { Plugin } from "../plugin";

/**
 * Builder interface used during application setup.
 * It lets you register plugins, global providers, and modules before startup.
 */

export interface ApplicationBuilder {
  /**
   * Registers a Trinacria plugin.
   */
  use(plugin: Plugin): this;

  /**
   * Registers a global provider before the application starts.
   */
  registerGlobalProvider(provider: Provider): void;

  /**
   * Registers a module before the application starts.
   */
  registerModule(module: ModuleDefinition): Promise<void>;

  /**
   * Starts the application and transitions it to runtime.
   */
  start(): Promise<void>;
}
