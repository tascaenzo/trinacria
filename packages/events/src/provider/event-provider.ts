import {
  classProvider,
  type DependencyList,
  type Token,
} from "@trinacria/core";
import type { EventProvider } from "../contracts";
import { EVENT_PROVIDER_KIND } from "./kind";

/**
 * Registers a provider that exposes event subscriptions.
 */
export function eventProvider<T extends EventProvider>(
  token: Token<T>,
  useClass: new (...args: any[]) => T,
  deps?: DependencyList,
) {
  return classProvider(token, useClass, deps, EVENT_PROVIDER_KIND);
}
