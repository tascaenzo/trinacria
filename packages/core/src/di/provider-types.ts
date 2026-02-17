import type { Token } from "../token";
import type { ProviderKind } from "./provider-kind";

/**
 * Declarative dependency list for class/factory providers.
 */
export type DependencyList = readonly Token[];

/**
 * Utility type for values that may be sync or async.
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * Common base shape shared by all provider types.
 */
export interface BaseProvider<T = unknown> {
  readonly token: Token<T>;
  readonly kind?: ProviderKind<T>;
}

/**
 * Class-based provider.
 */
export interface ClassProvider<T> extends BaseProvider<T> {
  readonly useClass: new (...args: any[]) => T;
  readonly deps?: DependencyList;
}

/**
 * Factory-based provider.
 */
export interface FactoryProvider<T> extends BaseProvider<T> {
  readonly useFactory: (...args: any[]) => MaybePromise<T>;
  readonly deps?: DependencyList;
}

/**
 * Static value provider.
 */
export interface ValueProvider<T> extends BaseProvider<T> {
  readonly useValue: MaybePromise<T>;
}

/**
 * Union of all provider variants supported by the container.
 */
export type Provider<T = unknown> =
  | ClassProvider<T>
  | FactoryProvider<T>
  | ValueProvider<T>;
