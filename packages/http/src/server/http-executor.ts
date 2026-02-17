import type { HttpContext } from "../server/http-context";
import type { RouteDefinition } from "../routing/route-definition";
import { compose } from "../middleware/compose";
import { HttpMiddleware } from "../middleware/middleware-definition";

/**
 * Builds and executes middleware + handler pipelines for matched routes.
 * Pipelines are cached per RouteDefinition to avoid rebuilding on every request.
 */
export class HttpExecutor {
  private readonly pipelineCache = new WeakMap<
    RouteDefinition,
    (ctx: HttpContext) => Promise<unknown>
  >();

  constructor(private readonly globalMiddlewares: HttpMiddleware[] = []) {}

  createPipeline(route: RouteDefinition) {
    const existing = this.pipelineCache.get(route);
    if (existing) {
      return existing;
    }

    const pipeline = compose(
      [...this.globalMiddlewares, ...(route.middlewares ?? [])],
      route.handler,
    );

    this.pipelineCache.set(route, pipeline);
    return pipeline;
  }

  async execute(route: RouteDefinition, ctx: HttpContext) {
    const pipeline = this.createPipeline(route);
    return pipeline(ctx);
  }
}
