import type { Token } from "../token";
import type { ProviderKind } from "./provider-kind";

/**
 * Lista dichiarativa di dipendenze.
 */
export type DependencyList = readonly Token[];

/**
 * Tipo che rappresenta un valore sync o async.
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * Struttura base comune a tutti i provider.
 */
export interface BaseProvider<T = unknown> {
  readonly token: Token<T>;
  readonly kind?: ProviderKind<T>;
}

/**
 * Provider basato su classe.
 */
export interface ClassProvider<T> extends BaseProvider<T> {
  readonly useClass: new (...args: any[]) => T;
  readonly deps?: DependencyList;
}

/**
 * Provider basato su factory.
 */
export interface FactoryProvider<T> extends BaseProvider<T> {
  readonly useFactory: (...args: any[]) => MaybePromise<T>;
  readonly deps?: DependencyList;
}

/**
 * Provider basato su valore statico.
 */
export interface ValueProvider<T> extends BaseProvider<T> {
  readonly useValue: MaybePromise<T>;
}

/**
 * Unione completa dei provider supportati dal container.
 */
export type Provider<T = unknown> =
  | ClassProvider<T>
  | FactoryProvider<T>
  | ValueProvider<T>;
