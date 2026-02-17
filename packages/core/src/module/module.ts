import type { ModuleDefinition } from "./module-definition";

/**
 * Typed factory for declaring a module.
 *
 * It is only a declaration helper used to:
 * - improve type inference
 * - keep the API consistent with provider factories
 * - keep room for future DSL extensions
 *
 * It contains no runtime logic.
 */
export function defineModule<T extends ModuleDefinition>(
  definition: T,
): Readonly<T> {
  return definition;
}
