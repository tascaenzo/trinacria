import { classProvider, DependencyList, Token } from "@trinacria/core";
import { HTTP_CONTROLLER_KIND } from "./kind";
import { HttpController } from "./base-controller";

export function httpProvider<T extends HttpController>(
  token: Token<T>,
  useClass: new (...args: any[]) => T,
  deps?: DependencyList,
) {
  return classProvider(token, useClass, deps, HTTP_CONTROLLER_KIND);
}
