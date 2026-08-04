import {
  classProvider,
  type DependencyList,
  type Token,
} from "@trinacria/core";
import type { HttpController } from "./base-controller";
import { HTTP_CONTROLLER_KIND } from "./kind";

/**
 * Registers a controller class provider tagged as HTTP controller.
 * Tagged providers are discovered by the HTTP plugin at startup/runtime registration.
 */
export function httpProvider<T extends HttpController>(
  token: Token<T>,
  useClass: new (...args: any[]) => T,
  deps?: DependencyList,
) {
  return classProvider(token, useClass, deps, HTTP_CONTROLLER_KIND);
}
