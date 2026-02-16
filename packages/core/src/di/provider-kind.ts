/**
 * Brand interno per impedire la creazione manuale del tipo.
 * Non esportato.
 */
const PROVIDER_KIND_BRAND: unique symbol = Symbol("ProviderKind");

/**
 * Identificatore tipizzato per categorizzare provider.
 * Non contiene comportamento.
 * Il core non interpreta il kind.
 */
export type ProviderKind<T = unknown> = {
  readonly key: symbol;
  readonly description?: string;

  /**
   * Phantom type per mantenere coerenza con il tipo del provider.
   * Non esiste a runtime.
   */
  readonly [PROVIDER_KIND_BRAND]: T;
};

/**
 * Crea un ProviderKind tipizzato.
 *
 * @param description opzionale, utile per debug
 */
export function createProviderKind<T>(description?: string): ProviderKind<T> {
  return {
    key: Symbol(description),
    description,
  } as ProviderKind<T>;
}
