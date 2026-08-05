import { createToken } from "@trinacria/core";
import type { UsersController } from "./users.controller";
import type { UsersService } from "./users.service";

export const USERS_SERVICE = createToken<UsersService>("USERS_SERVICE");
export const USERS_CONTROLLER =
  createToken<UsersController>("USERS_CONTROLLER");
