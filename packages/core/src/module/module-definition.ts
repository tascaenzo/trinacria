import type { Provider } from "../di/provider-types";
import type { Token } from "../token";

/**
 * Definizione dichiarativa di un modulo.
 *
 * Un modulo:
 * - Organizza provider
 * - Definisce import
 * - Definisce export
 * - Non contiene logica runtime
 */
export interface ModuleDefinition {
  /**
   * Nome univoco del modulo.
   * Usato solo per debug / errori.
   */
  readonly name: string;

  /**
   * Moduli importati.
   * I loro export diventeranno visibili al modulo corrente.
   */
  readonly imports?: readonly ModuleDefinition[];

  /**
   * Provider locali al modulo.
   * Sono visibili solo internamente,
   * salvo quelli dichiarati in exports.
   */
  readonly providers?: readonly Provider[];

  /**
   * Token esportati verso il root container.
   * Solo questi saranno accessibili ad altri moduli.
   */
  readonly exports?: readonly Token<any>[];
}
