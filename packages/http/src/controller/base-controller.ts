import type { RouteDefinition } from "../routing/route-definition";
import { RouteBuilder } from "../routing/route-builder";

export abstract class HttpController {
  protected router(): RouteBuilder<this> {
    return new RouteBuilder<this>(this);
  }

  abstract routes(): RouteDefinition[];
}
