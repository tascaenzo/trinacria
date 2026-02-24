import { classProvider, defineModule } from "@trinacria/core";
import { httpProvider } from "@trinacria/http";
import { PRISMA_SERVICE } from "../../global/prisma.service";
import { USERS_CONTROLLER, USERS_SERVICE } from "./users.tokens";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

export const UsersModule = defineModule({
  name: "UsersModule",
  providers: [
    classProvider(USERS_SERVICE, UsersService, [PRISMA_SERVICE]),
    httpProvider(USERS_CONTROLLER, UsersController, [USERS_SERVICE]),
  ],
  exports: [USERS_SERVICE, USERS_CONTROLLER],
});
