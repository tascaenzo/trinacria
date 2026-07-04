import { createToken } from "@trinacria/core";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

export const USERS_SERVICE = createToken<UsersService>("USERS_SERVICE");
export const USERS_CONTROLLER =
  createToken<UsersController>("USERS_CONTROLLER");
