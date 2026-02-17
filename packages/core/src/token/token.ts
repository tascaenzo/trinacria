export interface Token<T = unknown> {
  readonly key: symbol;
  readonly description?: string;
  readonly __type?: T; // Phantom type used only for compile-time inference.
}

/**
 * Creates a typed token used as a unique DI key.
 * The optional description is only for diagnostics.
 */
export function createToken<T>(description?: string): Token<T> {
  return {
    key: Symbol(description),
    description,
  };
}
