import { classProvider, DependencyList, Token } from "@trinacria/core";
import { HTTP_CONTROLLER_KIND } from "./kind";
import { HttpController } from "./base-controller";

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
