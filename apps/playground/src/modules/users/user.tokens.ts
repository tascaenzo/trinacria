import { createToken } from "@trinacria/core";
import type { EventProvider } from "@trinacria/events";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";

export const USER_SERVICE = createToken<UserService>("USER_SERVICE");
export const USER_CONTROLLER = createToken<UserController>("USER_CONTROLLER");
export const USER_EVENTS_PROVIDER =
  createToken<EventProvider>("USER_EVENTS_PROVIDER");
