import type { Token } from "../token";
import {
  isClassProvider,
  isFactoryProvider,
  isValueProvider,
} from "./provider";
import type { ProviderKind } from "./provider-kind";
import type { MaybePromise, Provider } from "./provider-types";
import {
  CircularDependencyError,
  ContainerStateError,
  DuplicateProviderError,
  ProviderNotFoundError,
  UnknownProviderTypeError,
} from "../errors";

/**
 * Hierarchical dependency injection container.
 * A container can resolve locally registered providers and delegate missing tokens to its parent.
 */
export class Container {
  /**
   * Providers registered in the current container scope.
   */
  private readonly providers = new Map<symbol, Provider<any>>();

  /**
   * Singleton cache. Values are stored as Promise to support async providers.
   */
  private readonly instances = new Map<symbol, Promise<unknown>>();

  /**
   * Tracks tokens currently being resolved to detect circular dependencies.
   */
  private readonly resolving = new Set<symbol>();
  private readonly creationOrder: symbol[] = [];

  /**
   * Initialization state flags.
   */
  private initialized = false;
  private initializing = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Parent container (upper scope fallback).
   */
  constructor(private readonly parent?: Container) {}

  // --------------------------------------------------
  // REGISTRATION
  // --------------------------------------------------

  register<T>(provider: Provider<T>, force = false): void {
    if (this.initialized && !force) {
      throw new ContainerStateError(
        "Cannot register providers after container initialization.",
      );
    }

    const key = provider.token.key;

    if (this.providers.has(key)) {
      throw new DuplicateProviderError(
        `Provider for token ${describeToken(provider.token)} is already registered.`,
      );
    }

    this.providers.set(key, provider);
  }

  unregister(token: Token<any>, force = false): void {
    if (this.initialized && !force) {
      throw new ContainerStateError(
        "Cannot remove providers after container initialization.",
      );
    }

    const key = token.key;
    this.providers.delete(key);
    this.instances.delete(key);
    const orderIndex = this.creationOrder.indexOf(key);
    if (orderIndex !== -1) {
      this.creationOrder.splice(orderIndex, 1);
    }
  }

  async unregisterAndDestroy(token: Token<any>, force = false): Promise<void> {
    const key = token.key;
    const instancePromise = this.instances.get(key);
    const provider = this.providers.get(key);

    if (instancePromise) {
      try {
        const instance = await instancePromise;
        if (provider?.lifecycle !== "external") {
          await this.runOnDestroy(instance);
        }
      } catch {
        // Keep unregister semantics deterministic even if destroy hook throws.
      }
    }

    this.unregister(token, force);
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
    if (this.initPromise) return this.initPromise;

    this.initializing = true;
    this.initPromise = (async () => {
      // Eagerly instantiate every local provider in this scope.
      for (const provider of this.providers.values()) {
        if (provider.eager === false) {
          continue;
        }
        await this.instantiate(provider);
      }

      this.initialized = true;
    })();

    try {
      await this.initPromise;
    } finally {
      this.initializing = false;
      this.initPromise = null;
    }
  }

  async destroy(): Promise<void> {
    const errors: unknown[] = [];
    const keys = [...this.creationOrder].reverse();

    for (const key of keys) {
      const instancePromise = this.instances.get(key);
      if (!instancePromise) continue;
      const provider = this.providers.get(key);
      if (provider?.lifecycle === "external") continue;

      try {
        const instance = await instancePromise;
        await this.runOnDestroy(instance);
      } catch (error) {
        errors.push(error);
      }
    }

    this.instances.clear();
    this.resolving.clear();
    this.creationOrder.length = 0;
    this.initialized = false;
    this.initializing = false;
    this.initPromise = null;

    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        "One or more provider onDestroy hooks failed.",
      );
    }
  }

  // --------------------------------------------------
  // RESOLUTION
  // --------------------------------------------------

  async resolve<T>(token: Token<T>): Promise<T> {
    if (!this.initialized && !this.initializing) {
      throw new ContainerStateError(
        "Container is not initialized. Call init() before resolve().",
      );
    }

    const key = token.key;

    if (this.instances.has(key)) {
      return this.instances.get(key) as Promise<T>;
    }

    const localProvider = this.providers.get(key);
    if (localProvider) {
      return this.instantiate(localProvider as Provider<T>);
    }

    if (this.parent) {
      return this.parent.resolve(token);
    }

    throw new ProviderNotFoundError(
      `No provider found for token ${describeToken(token)}.`,
    );
  }

  // --------------------------------------------------
  // INTERNAL INSTANTIATION
  // --------------------------------------------------

  private async instantiate<T>(provider: Provider<T>): Promise<T> {
    const key = provider.token.key;

    // Fast path: already instantiated (or already being instantiated).
    if (this.instances.has(key)) {
      return this.instances.get(key) as Promise<T>;
    }

    // Circular detection
    if (this.resolving.has(key)) {
      throw new CircularDependencyError(
        `Circular dependency detected for token ${describeToken(provider.token)}.`,
      );
    }

    this.resolving.add(key);

    const instancePromise = (async () => {
      try {
        // ValueProvider
        if (isValueProvider(provider)) {
          const value = await provider.useValue;
          if (provider.lifecycle !== "external") {
            await this.runOnInit(value);
          }
          return value;
        }

        // Resolve declared dependencies in order.
        const deps = await this.resolveDeps(provider.deps);

        // ClassProvider
        if (isClassProvider(provider)) {
          const value = new provider.useClass(...deps);
          if (provider.lifecycle !== "external") {
            await this.runOnInit(value);
          }
          return value;
        }

        // FactoryProvider
        if (isFactoryProvider(provider)) {
          const value = await provider.useFactory(...deps);
          if (provider.lifecycle !== "external") {
            await this.runOnInit(value);
          }
          return value;
        }

        throw new UnknownProviderTypeError("Unknown provider type.");
      } finally {
        this.resolving.delete(key);
      }
    })().catch((error) => {
      // Do not cache failed instantiations forever; allow a future retry.
      this.instances.delete(key);
      const orderIndex = this.creationOrder.indexOf(key);
      if (orderIndex !== -1) {
        this.creationOrder.splice(orderIndex, 1);
      }
      throw error;
    });

    this.instances.set(key, instancePromise);
    this.creationOrder.push(key);

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

  private async runOnInit(instance: unknown): Promise<void> {
    if (isLifecycleAware(instance) && typeof instance.onInit === "function") {
      await instance.onInit();
    }
  }

  private async runOnDestroy(instance: unknown): Promise<void> {
    if (
      isLifecycleAware(instance) &&
      typeof instance.onDestroy === "function"
    ) {
      await instance.onDestroy();
    }
  }
}

// --------------------------------------------------
// UTIL
// --------------------------------------------------

function describeToken(token: Token<any>): string {
  return token.description ?? token.key.toString();
}

interface LifecycleAware {
  onInit?: () => MaybePromise<void>;
  onDestroy?: () => MaybePromise<void>;
}

function isLifecycleAware(value: unknown): value is LifecycleAware {
  return typeof value === "object" && value !== null;
}
