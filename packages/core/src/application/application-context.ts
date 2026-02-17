import type { Token } from "../token";
import type { Provider } from "../di/provider-types";
import type { ProviderKind } from "../di/provider-kind";
import type { ModuleDefinition } from "../module/module-definition";
import type { ModuleGraphSnapshot } from "../module";

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
   * Returns true when a module with the same name is currently registered.
   */
  isModuleRegistered(module: ModuleDefinition): boolean;

  /**
   * Returns the list of registered module names.
   */
  listModules(): string[];

  /**
   * Returns true if a token is currently visible in the root container.
   */
  hasToken<T>(token: Token<T>): boolean;

  /**
   * Returns a runtime snapshot of the module/provider graph.
   */
  describeGraph(): ModuleGraphSnapshot;

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
