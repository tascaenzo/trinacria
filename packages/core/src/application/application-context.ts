import type { Token } from "../token";
import type { Provider } from "../di/provider-types";
import type { ProviderKind } from "../di/provider-kind";
import type { ModuleDefinition } from "../module/module-definition";

/**
 * Public runtime API exposed to plugins.
 * Internal details (registry/container) are intentionally hidden.
 */
export interface ApplicationContext {
  /**
   * Resolves a provider instance from its token.
   */
  resolve<T>(token: Token<T>): Promise<T>;

  /**
   * Returns all exported providers associated with a specific ProviderKind.
   */
  getProvidersByKind<T>(kind: ProviderKind<T>): Provider<T>[];

  /**
   * Registers a module dynamically at runtime.
   */
  registerModule(module: ModuleDefinition): Promise<void>;

  /**
   * Unregisters a module dynamically at runtime.
   */
  unregisterModule(module: ModuleDefinition): Promise<void>;

  /**
   * Shuts down the application and releases allocated resources.
   */
  shutdown(): Promise<void>;
}
