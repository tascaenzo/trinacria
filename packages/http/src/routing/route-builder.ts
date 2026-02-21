import type {
  RouteDefinition,
  HttpMethod,
  RouteHandler,
  RouteOptions,
} from "./route-definition";
import type { HttpMiddleware } from "../middleware/middleware-definition";

type HandlerInput<C> = RouteHandler | keyof C;

/**
 * Fluent builder used by controllers to declare route definitions.
 * Handlers can be passed as bound functions or method names.
 */
export class RouteBuilder<C = any> {
  private readonly routes: RouteDefinition[] = [];

  constructor(private readonly controller: C) {}

  /**
   * Resolves handler input to a callable function bound to controller instance.
   */
  private resolveHandler(
    handler: HandlerInput<C>,
  ): { fn: RouteHandler; handlerName?: string } {
    if (typeof handler === "string") {
      const fn = (this.controller as Record<string, unknown>)[handler];

      if (typeof fn !== "function") {
        throw new Error(
          `Handler "${String(handler)}" is not a function on controller`,
        );
      }

      return {
        fn: (fn as RouteHandler).bind(this.controller),
        handlerName: handler,
      };
    }

    const methodName = this.findControllerMethodName(handler);
    if (methodName) {
      const fn = (this.controller as Record<string, unknown>)[methodName];
      return {
        fn: (fn as RouteHandler).bind(this.controller),
        handlerName: methodName,
      };
    }

    return { fn: handler as RouteHandler };
  }

  private findControllerMethodName(handler: unknown): string | null {
    if (typeof handler !== "function") {
      return null;
    }

    let proto = Object.getPrototypeOf(this.controller);
    while (proto && proto !== Object.prototype) {
      const keys = Object.getOwnPropertyNames(proto);

      for (const key of keys) {
        if (key === "constructor") continue;

        const descriptor = Object.getOwnPropertyDescriptor(proto, key);
        if (descriptor?.value === handler) {
          return key;
        }
      }

      proto = Object.getPrototypeOf(proto);
    }

    return null;
  }

  private add(
    method: HttpMethod,
    path: string,
    handler: HandlerInput<C>,
    args: Array<HttpMiddleware | RouteOptions> = [],
  ): this {
    const resolved = this.resolveHandler(handler);
    const { middlewares, docs } = this.parseArgs(args);

    this.routes.push({
      method,
      path,
      handler: resolved.fn,
      handlerName: resolved.handlerName,
      middlewares: middlewares.length ? middlewares : undefined,
      docs,
    });

    return this;
  }

  private parseArgs(
    args: Array<HttpMiddleware | RouteOptions>,
  ): { middlewares: HttpMiddleware[]; docs: RouteOptions["docs"] } {
    if (args.length === 0) {
      return { middlewares: [], docs: undefined };
    }

    const [first, ...rest] = args;
    if (this.isRouteOptions(first)) {
      return {
        middlewares: first.middlewares ?? [],
        docs: first.docs,
      };
    }

    return {
      middlewares: [first as HttpMiddleware, ...(rest as HttpMiddleware[])],
      docs: undefined,
    };
  }

  private isRouteOptions(value: unknown): value is RouteOptions {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    return "docs" in value || "middlewares" in value;
  }

  get(
    path: string,
    handler: HandlerInput<C>,
    ...args: Array<HttpMiddleware | RouteOptions>
  ) {
    return this.add("GET", path, handler, args);
  }

  post(
    path: string,
    handler: HandlerInput<C>,
    ...args: Array<HttpMiddleware | RouteOptions>
  ) {
    return this.add("POST", path, handler, args);
  }

  put(
    path: string,
    handler: HandlerInput<C>,
    ...args: Array<HttpMiddleware | RouteOptions>
  ) {
    return this.add("PUT", path, handler, args);
  }

  patch(
    path: string,
    handler: HandlerInput<C>,
    ...args: Array<HttpMiddleware | RouteOptions>
  ) {
    return this.add("PATCH", path, handler, args);
  }

  delete(
    path: string,
    handler: HandlerInput<C>,
    ...args: Array<HttpMiddleware | RouteOptions>
  ) {
    return this.add("DELETE", path, handler, args);
  }

  options(
    path: string,
    handler: HandlerInput<C>,
    ...args: Array<HttpMiddleware | RouteOptions>
  ) {
    return this.add("OPTIONS", path, handler, args);
  }

  head(
    path: string,
    handler: HandlerInput<C>,
    ...args: Array<HttpMiddleware | RouteOptions>
  ) {
    return this.add("HEAD", path, handler, args);
  }

  build(): RouteDefinition[] {
    return this.routes;
  }
}
