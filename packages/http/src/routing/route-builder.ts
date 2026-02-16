import type {
  RouteDefinition,
  HttpMethod,
  RouteHandler,
} from "./route-definition";
import type { HttpMiddleware } from "../middleware/middleware-definition";

type HandlerInput<C> = RouteHandler | keyof C;

export class RouteBuilder<C = any> {
  private readonly routes: RouteDefinition[] = [];

  constructor(private readonly controller: C) {}

  private resolveHandler(handler: HandlerInput<C>): RouteHandler {
    if (typeof handler === "string") {
      const fn = (this.controller as Record<string, unknown>)[handler];

      if (typeof fn !== "function") {
        throw new Error(
          `Handler "${String(handler)}" is not a function on controller`,
        );
      }

      return (fn as RouteHandler).bind(this.controller);
    }

    return handler as RouteHandler;
  }

  private add(
    method: HttpMethod,
    path: string,
    handler: HandlerInput<C>,
    middlewares: HttpMiddleware[] = [],
  ): this {
    this.routes.push({
      method,
      path,
      handler: this.resolveHandler(handler),
      middlewares: middlewares.length ? middlewares : undefined,
    });

    return this;
  }

  get(
    path: string,
    handler: HandlerInput<C>,
    ...middlewares: HttpMiddleware[]
  ) {
    return this.add("GET", path, handler, middlewares);
  }

  post(
    path: string,
    handler: HandlerInput<C>,
    ...middlewares: HttpMiddleware[]
  ) {
    return this.add("POST", path, handler, middlewares);
  }

  put(
    path: string,
    handler: HandlerInput<C>,
    ...middlewares: HttpMiddleware[]
  ) {
    return this.add("PUT", path, handler, middlewares);
  }

  patch(
    path: string,
    handler: HandlerInput<C>,
    ...middlewares: HttpMiddleware[]
  ) {
    return this.add("PATCH", path, handler, middlewares);
  }

  delete(
    path: string,
    handler: HandlerInput<C>,
    ...middlewares: HttpMiddleware[]
  ) {
    return this.add("DELETE", path, handler, middlewares);
  }

  options(
    path: string,
    handler: HandlerInput<C>,
    ...middlewares: HttpMiddleware[]
  ) {
    return this.add("OPTIONS", path, handler, middlewares);
  }

  head(
    path: string,
    handler: HandlerInput<C>,
    ...middlewares: HttpMiddleware[]
  ) {
    return this.add("HEAD", path, handler, middlewares);
  }

  build(): RouteDefinition[] {
    return this.routes;
  }
}
