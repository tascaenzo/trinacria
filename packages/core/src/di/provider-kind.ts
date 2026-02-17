/**
 * Internal brand used to prevent manual construction of the type.
 * Not exported.
 */
const PROVIDER_KIND_BRAND: unique symbol = Symbol("ProviderKind");

/**
 * Typed identifier used to categorize providers.
 * It has no runtime behavior.
 * The core stores it but does not interpret its semantics.
 */
export type ProviderKind<T = unknown> = {
  readonly key: symbol;
  readonly description?: string;

  /**
   * Phantom type that keeps ProviderKind aligned with provider payload type.
   * It does not exist at runtime.
   */
  readonly [PROVIDER_KIND_BRAND]: T;
};

/**
 * Creates a typed ProviderKind.
 *
 * @param description optional label useful for debugging
 */
export function createProviderKind<T>(description?: string): ProviderKind<T> {
  return {
    key: Symbol(description),
    description,
  } as ProviderKind<T>;
}
