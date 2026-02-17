import { createProviderKind } from "@trinacria/core";
import { HttpController } from "./base-controller";

/**
 * ProviderKind marker used by the HTTP plugin to discover controller providers.
 */
export const HTTP_CONTROLLER_KIND =
  createProviderKind<HttpController>("http:controller");
