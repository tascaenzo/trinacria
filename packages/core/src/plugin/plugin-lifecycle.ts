import type { ApplicationContext } from "../application/application-context";
import type { ModuleDefinition } from "../module/module-definition";

/**
 * Contratto di un plugin Trinacria.
 * Definisce il lifecycle completo del plugin.
 */
export interface Plugin {
  /**
   * Nome plugin (debug / logging).
   */
  readonly name: string;

  /**
   * Chiamato prima della build dei moduli.
   * Permette al plugin di registrare provider o estensioni globali.
   */
  onRegister?(app: ApplicationContext): Promise<void> | void;

  /**
   * Chiamato dopo il bootstrap completo dell'applicazione.
   * Tutti i provider sono già istanziati.
   */
  onInit?(app: ApplicationContext): Promise<void> | void;

  /**
   * Chiamato quando un modulo viene registrato a runtime.
   */
  onModuleRegistered?(
    module: ModuleDefinition,
    app: ApplicationContext,
  ): Promise<void> | void;

  /**
   * Chiamato quando un modulo viene rimosso a runtime.
   */
  onModuleUnregistered?(
    module: ModuleDefinition,
    app: ApplicationContext,
  ): Promise<void> | void;

  /**
   * Chiamato prima dello shutdown dell'applicazione.
   */
  onDestroy?(app: ApplicationContext): Promise<void> | void;
}
