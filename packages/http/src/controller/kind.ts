import { createProviderKind } from "@trinacria/core";
import { HttpController } from "./base-controller";

export const HTTP_CONTROLLER_KIND =
  createProviderKind<HttpController>("http:controller");
