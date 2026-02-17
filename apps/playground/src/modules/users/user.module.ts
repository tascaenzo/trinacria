import { classProvider, defineModule } from "@trinacria/core";
import { httpProvider } from "@trinacria/http";
import { UserService } from "./user.service";
import { UserController } from "./user.controller";
import {
  USER_CONTROLLER,
  USER_SERVICE,
} from "./user.tokens";

export const UserModule = defineModule({
  name: "UserModule",
  providers: [
    classProvider(USER_SERVICE, UserService),
    httpProvider(USER_CONTROLLER, UserController, [USER_SERVICE]),
  ],
  exports: [USER_SERVICE, USER_CONTROLLER],
});
