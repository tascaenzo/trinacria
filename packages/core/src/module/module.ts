import type { ModuleDefinition } from "./module-definition";

/**
 * Factory tipizzata per definire un modulo.
 *
 * Serve solo come helper per:
 * - Migliorare la type inference
 * - Rendere più coerente l'API con i provider
 * - Preparare il terreno per eventuali estensioni future
 *
 * Non contiene logica runtime.
 */
export function defineModule<T extends ModuleDefinition>(
  definition: T,
): Readonly<T> {
  return definition;
}
