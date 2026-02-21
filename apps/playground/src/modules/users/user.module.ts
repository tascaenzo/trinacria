import { classProvider, defineModule } from "@trinacria/core";
import { httpProvider } from "@trinacria/http";
import { PRISMA_SERVICE } from "../../global-service/prisma.service";
import { AuthModule } from "../auth/auth.module";
import { AUTH_GUARD_FACTORY } from "../auth/auth-guard.factory";
import { UserService } from "./user.service";
import { UserController } from "./user.controller";
import { USER_CONTROLLER, USER_SERVICE } from "./user.tokens";

export const UserModule = defineModule({
  name: "UserModule",
  imports: [AuthModule],
  providers: [
    classProvider(USER_SERVICE, UserService, [PRISMA_SERVICE]),
    httpProvider(USER_CONTROLLER, UserController, [
      USER_SERVICE,
      AUTH_GUARD_FACTORY,
    ]),
  ],
  exports: [USER_SERVICE, USER_CONTROLLER],
});
