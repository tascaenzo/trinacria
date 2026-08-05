import { classProvider, defineModule } from "@trinacria/core";
import { EVENT_BUS_TOKEN, eventProvider } from "@trinacria/events";
import { httpProvider } from "@trinacria/http";
import { PRISMA_SERVICE } from "../../global-service/prisma.service";
import { AuthModule } from "../auth/auth.module";
import { AUTH_GUARD_FACTORY } from "../auth/auth-guard.factory";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";
import {
  USER_CONTROLLER,
  USER_EVENTS_PROVIDER,
  USER_SERVICE,
} from "./user.tokens";
import { UserEventsProvider } from "./user-events.provider";

export const UserModule = defineModule({
  name: "UserModule",
  imports: [AuthModule],
  providers: [
    classProvider(USER_SERVICE, UserService, [PRISMA_SERVICE]),
    httpProvider(USER_CONTROLLER, UserController, [
      USER_SERVICE,
      AUTH_GUARD_FACTORY,
      EVENT_BUS_TOKEN,
    ]),
    eventProvider(USER_EVENTS_PROVIDER, UserEventsProvider),
  ],
  exports: [USER_SERVICE, USER_CONTROLLER, USER_EVENTS_PROVIDER],
});
