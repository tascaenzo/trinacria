import { HttpMiddleware } from "./middleware-definition";
import { HttpContext } from "../server/http-context";

/**
 * Composes middleware stack using a Koa-style `next()` chain.
 * Throws when `next()` is called multiple times in the same middleware.
 */
export function compose<T>(
  middlewares: HttpMiddleware<T>[],
  handler: (ctx: HttpContext) => T | Promise<T>,
) {
  return async function run(ctx: HttpContext): Promise<T> {
    let index = -1;

    async function dispatch(i: number): Promise<T> {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }

      index = i;

      if (i === middlewares.length) {
        return handler(ctx);
      }

      const middleware = middlewares[i];

      return middleware(ctx, () => dispatch(i + 1));
    }

    return dispatch(0);
  };
}
