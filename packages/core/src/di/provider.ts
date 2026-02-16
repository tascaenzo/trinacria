import type {
  ClassProvider,
  FactoryProvider,
  ValueProvider,
  DependencyList,
  MaybePromise,
  Provider,
} from "./provider-types";

import type { Token } from "../token";
import type { ProviderKind } from "./provider-kind";

/**
 * Crea un ClassProvider tipizzato.
 */
export function classProvider<T>(
  token: Token<T>,
  useClass: new (...args: any[]) => T,
  deps?: DependencyList,
  kind?: ProviderKind<T>,
): ClassProvider<T> {
  return {
    token,
    useClass,
    deps,
    kind,
  };
}

/**
 * Crea un FactoryProvider tipizzato.
 */
export function factoryProvider<T>(
  token: Token<T>,
  useFactory: (...args: any[]) => MaybePromise<T>,
  deps?: DependencyList,
  kind?: ProviderKind<T>,
): FactoryProvider<T> {
  return {
    token,
    useFactory,
    deps,
    kind,
  };
}

/**
 * Crea un ValueProvider tipizzato.
 */
export function valueProvider<T>(
  token: Token<T>,
  useValue: MaybePromise<T>,
  kind?: ProviderKind<T>,
): ValueProvider<T> {
  return {
    token,
    useValue,
    kind,
  };
}

// --------------------------------------------------
// TYPE GUARDS
// --------------------------------------------------

export function isClassProvider<T>(
  provider: Provider<T>,
): provider is ClassProvider<T> {
  return "useClass" in provider;
}

export function isFactoryProvider<T>(
  provider: Provider<T>,
): provider is FactoryProvider<T> {
  return "useFactory" in provider;
}

export function isValueProvider<T>(
  provider: Provider<T>,
): provider is ValueProvider<T> {
  return "useValue" in provider;
}
