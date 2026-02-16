import { Provider } from "../di/provider-types";
import { ModuleDefinition } from "../module/module-definition";
import { Plugin } from "../plugin";
import { ApplicationContext } from "./application-context";

/**
 * Builder per la configurazione e l'avvio dell'applicazione.
 * Permette di registrare plugin, provider e moduli prima di avviare l'app.
 */

export interface ApplicationBuilder {
  /**
   * Registrazione plugin Trinacria.
   */
  use(plugin: Plugin): this;

  /**
   * Registra un provaider globale priam di avviare l'app
   */
  registerGlobalProvider(provider: Provider): void;

  /**
   * Registra un modulo prima di avviare l'app.
   */
  registerModule(module: ModuleDefinition): Promise<void>;

  /**
   * Avvia l'applicazione, restituendo il contesto runtime.
   */
  start(): Promise<void>;
}
