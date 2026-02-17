import type { ApplicationContext } from "../application/application-context";
import type { ModuleDefinition } from "../module/module-definition";

/**
 * Contract implemented by Trinacria plugins.
 * It defines the full plugin lifecycle.
 */
export interface Plugin {
  /**
   * Plugin name used for diagnostics/logging.
   */
  readonly name: string;

  /**
   * Called before module graph build.
   * Useful for registering global providers or runtime extensions.
   */
  onRegister?(app: ApplicationContext): Promise<void> | void;

  /**
   * Called after bootstrap is complete.
   * At this point all providers have been instantiated.
   */
  onInit?(app: ApplicationContext): Promise<void> | void;

  /**
   * Called when a module is registered dynamically at runtime.
   */
  onModuleRegistered?(
    module: ModuleDefinition,
    app: ApplicationContext,
  ): Promise<void> | void;

  /**
   * Called when a module is unregistered dynamically at runtime.
   */
  onModuleUnregistered?(
    module: ModuleDefinition,
    app: ApplicationContext,
  ): Promise<void> | void;

  /**
   * Called before application shutdown.
   */
  onDestroy?(app: ApplicationContext): Promise<void> | void;
}
