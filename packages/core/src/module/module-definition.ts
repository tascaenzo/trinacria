import type { Provider } from "../di/provider-types";
import type { Token } from "../token";

/**
 * Declarative module definition.
 *
 * A module:
 * - organizes providers
 * - declares imports
 * - declares exports
 * - contains no runtime behavior
 */
export interface ModuleDefinition {
  /**
   * Unique module name.
   * Used for diagnostics and error messages.
   */
  readonly name: string;

  /**
   * Imported modules.
   * Their exported tokens become visible to the current module.
   */
  readonly imports?: readonly ModuleDefinition[];

  /**
   * Module-local providers.
   * They are private unless explicitly re-exported.
   */
  readonly providers?: readonly Provider[];

  /**
   * Tokens exported to the root container.
   * Only these tokens are accessible from other modules.
   */
  readonly exports?: readonly Token<any>[];
}
