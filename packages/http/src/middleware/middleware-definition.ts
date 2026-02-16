import { HttpContext } from "../server";

export type HttpMiddleware<T = unknown> = (
  ctx: HttpContext,
  next: () => Promise<T>,
) => Promise<T>;
