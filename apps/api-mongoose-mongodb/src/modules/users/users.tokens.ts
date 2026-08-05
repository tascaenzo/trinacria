import { createToken } from "@trinacria/core";
import type { UsersController } from "./users.controller";
import type { UserSchemaModel } from "./users.schema";
import type { UsersService } from "./users.service";

export const USER_SCHEMA = createToken<UserSchemaModel>("USER_SCHEMA");
export const USERS_SERVICE = createToken<UsersService>("USERS_SERVICE");
export const USERS_CONTROLLER =
  createToken<UsersController>("USERS_CONTROLLER");
