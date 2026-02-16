import type { HttpContext } from "../server/http-context";
import type { RouteDefinition } from "../routing/route-definition";
import { compose } from "../middleware/compose";
import { HttpMiddleware } from "../middleware/middleware-definition";

export class HttpExecutor {
  constructor(private readonly globalMiddlewares: HttpMiddleware[] = []) {}

  createPipeline(route: RouteDefinition) {
    return compose(
      [...this.globalMiddlewares, ...(route.middlewares ?? [])],
      route.handler,
    );
  }

  async execute(route: RouteDefinition, ctx: HttpContext) {
    const pipeline = this.createPipeline(route);
    return pipeline(ctx);
  }
}
