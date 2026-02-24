import { classProvider, defineModule } from "@trinacria/core";
import { httpProvider } from "@trinacria/http";
import { createMongooseSchemaProvider } from "../../global/mongoose-schema.provider";
import { USERS_CONTROLLER, USERS_SERVICE, USER_SCHEMA } from "./users.tokens";
import { UsersController } from "./users.controller";
import { userSchema } from "./users.schema";
import { UsersService } from "./users.service";

export const UsersModule = defineModule({
  name: "UsersModule",
  providers: [
    createMongooseSchemaProvider(USER_SCHEMA, "User", userSchema),
    classProvider(USERS_SERVICE, UsersService, [USER_SCHEMA]),
    httpProvider(USERS_CONTROLLER, UsersController, [USERS_SERVICE]),
  ],
  exports: [USERS_SERVICE, USERS_CONTROLLER],
});
