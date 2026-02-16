import type { Token } from "../token";
import {
  isClassProvider,
  isFactoryProvider,
  isValueProvider,
} from "./provider";
import type { ProviderKind } from "./provider-kind";
import type { Provider } from "./provider-types";

export class Container {
  /**
   * Provider registrati nel container corrente.
   */
  private readonly providers = new Map<symbol, Provider<any>>();

  /**
   * Cache singleton (Promise per supportare async).
   */
  private readonly instances = new Map<symbol, Promise<unknown>>();

  /**
   * Stack corrente per rilevare dipendenze circolari.
   */
  private readonly resolving = new Set<symbol>();

  /**
   * Stato di inizializzazione.
   */
  private initialized = false;

  /**
   * Container padre (scope superiore).
   */
  constructor(private readonly parent?: Container) {}

  // --------------------------------------------------
  // REGISTRATION
  // --------------------------------------------------

  register<T>(provider: Provider<T>): void {
    if (this.initialized) {
      throw new Error(
        "Non è possibile registrare provider dopo l'inizializzazione del container.",
      );
    }

    const key = provider.token.key;

    if (this.providers.has(key)) {
      throw new Error(
        `Provider per token ${describeToken(provider.token)} già registrato.`,
      );
    }

    this.providers.set(key, provider);
  }

  unregister(token: Token<any>): void {
    if (this.initialized) {
      throw new Error(
        "Non è possibile rimuovere provider dopo l'inizializzazione del container.",
      );
    }

    const key = token.key;
    this.providers.delete(key);
    this.instances.delete(key);
  }

  has(token: Token<any>): boolean {
    if (this.providers.has(token.key)) return true;
    return this.parent?.has(token) ?? false;
  }

  // --------------------------------------------------
  // BOOTSTRAP (EAGER)
  // --------------------------------------------------

  async init(): Promise<void> {
    if (this.initialized) return;

    // Istanzia tutti i provider locali
    for (const provider of this.providers.values()) {
      await this.instantiate(provider);
    }

    this.initialized = true;
  }

  // --------------------------------------------------
  // RESOLUTION
  // --------------------------------------------------

  async resolve<T>(token: Token<T>): Promise<T> {
    if (!this.initialized) {
      throw new Error(
        "Container non inizializzato. Chiama init() prima di resolve().",
      );
    }

    const key = token.key;

    if (this.instances.has(key)) {
      return this.instances.get(key) as Promise<T>;
    }

    if (this.parent) {
      return this.parent.resolve(token);
    }

    throw new Error(
      `Nessun provider trovato per token ${describeToken(token)}.`,
    );
  }

  // --------------------------------------------------
  // INTERNAL INSTANTIATION
  // --------------------------------------------------

  private async instantiate<T>(provider: Provider<T>): Promise<T> {
    const key = provider.token.key;

    // Se già istanziato
    if (this.instances.has(key)) {
      return this.instances.get(key) as Promise<T>;
    }

    // Circular detection
    if (this.resolving.has(key)) {
      throw new Error(
        `Dipendenza circolare rilevata per token ${describeToken(provider.token)}.`,
      );
    }

    this.resolving.add(key);

    const instancePromise = (async () => {
      try {
        // ValueProvider
        if (isValueProvider(provider)) {
          return await provider.useValue;
        }

        // Risolvi dipendenze
        const deps = await this.resolveDeps(provider.deps);

        // ClassProvider
        if (isClassProvider(provider)) {
          return new provider.useClass(...deps);
        }

        // FactoryProvider
        if (isFactoryProvider(provider)) {
          return await provider.useFactory(...deps);
        }

        throw new Error("Tipo di provider sconosciuto.");
      } finally {
        this.resolving.delete(key);
      }
    })();

    this.instances.set(key, instancePromise);

    return instancePromise;
  }

  private async resolveDeps(deps?: readonly Token<any>[]): Promise<unknown[]> {
    if (!deps || deps.length === 0) return [];

    const results = new Array(deps.length);

    for (let i = 0; i < deps.length; i++) {
      results[i] = await this.resolve(deps[i]);
    }

    return results;
  }

  // --------------------------------------------------
  // INTROSPECTION
  // --------------------------------------------------

  getProviders(): Provider<any>[] {
    return Array.from(this.providers.values());
  }

  getProvidersByKind<T>(kind: ProviderKind<T>): Provider<T>[] {
    return this.getProviders().filter((p): p is Provider<T> => p.kind === kind);
  }
}

// --------------------------------------------------
// UTIL
// --------------------------------------------------

function describeToken(token: Token<any>): string {
  return token.description ?? token.key.toString();
}
