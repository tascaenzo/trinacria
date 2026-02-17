/**
 * Base class for all framework-level errors exposed by @trinacria/core.
 * Keeps error typing explicit for plugins and application code.
 */
export class CoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

// Application lifecycle/state misuse (e.g. invalid registration phase).
export class ApplicationStateError extends CoreError {}

// Module registration flow failures (duplicate registration, invalid state, etc.).
export class ModuleRegistrationError extends CoreError {}

// Compensation/rollback failure after a runtime module registration error.
export class ModuleRegistrationRollbackError extends CoreError {}

// Module graph/visibility dependency violations.
export class ModuleDependencyError extends CoreError {}

// Runtime module removal failures.
export class ModuleUnregistrationError extends CoreError {}

// Invalid export declarations in module definitions.
export class ModuleExportError extends CoreError {}

// Token conflicts across module exports/global scope.
export class TokenConflictError extends CoreError {}

// Invalid container state transitions.
export class ContainerStateError extends CoreError {}

// Duplicate provider registration within the same container scope.
export class DuplicateProviderError extends CoreError {}

// Provider lookup failures.
export class ProviderNotFoundError extends CoreError {}

// Circular dependency detection during provider resolution.
export class CircularDependencyError extends CoreError {}

// Provider shape is not recognized by the container runtime.
export class UnknownProviderTypeError extends CoreError {}
