import { RouteBuilder } from "../routing/route-builder";
import type { RouteDefinition } from "../routing/route-definition";

/**
 * Base class for HTTP controllers.
 * Subclasses declare routes through `routes()` and can use `this.router()` DSL helper.
 */
export abstract class HttpController {
  protected router(): RouteBuilder<this> {
    return new RouteBuilder<this>(this);
  }

  abstract routes(): RouteDefinition[];
}
