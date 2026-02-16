export interface Token<T = unknown> {
  readonly key: symbol;
  readonly description?: string;
  readonly __type?: T; // phantom type
}

export function createToken<T>(description?: string): Token<T> {
  return {
    key: Symbol(description),
    description,
  };
}
