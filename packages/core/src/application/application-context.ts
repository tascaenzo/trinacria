import type { Token } from "../token";
import type { Provider } from "../di/provider-types";
import type { ProviderKind } from "../di/provider-kind";
import type { ModuleDefinition } from "../module/module-definition";

/**
 * API pubblica runtime esposta ai plugin.
 * Non espone dettagli interni (registry, container).
 */
export interface ApplicationContext {
  /**
   * Risolve un provider tramite token.
   */
  resolve<T>(token: Token<T>): Promise<T>;

  /**
   * Restituisce tutti i provider esportati compatibili con un ProviderKind.
   */
  getProvidersByKind<T>(kind: ProviderKind<T>): Provider<T>[];

  /**
   * Registra dinamicamente un modulo a runtime.
   */
  registerModule(module: ModuleDefinition): Promise<void>;

  /**
   * Rimuove dinamicamente un modulo a runtime.
   */
  unregisterModule(module: ModuleDefinition): Promise<void>;

  /**
   * Chiude l'applicazione, rilasciando tutte le risorse allocate.
   */
  shutdown(): Promise<void>;
}
