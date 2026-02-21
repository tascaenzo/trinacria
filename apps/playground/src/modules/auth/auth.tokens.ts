import { createToken } from "@trinacria/core";
import { AuthController } from "./auth.controller";
import { AuthConfig } from "./auth.config";
import { AuthGuardFactory } from "./auth-guard.factory";
import { AuthService } from "./auth.service";
import { JwtSigner } from "./jwt";

export const AUTH_CONTROLLER = createToken<AuthController>("AUTH_CONTROLLER");
export const AUTH_GUARD_FACTORY =
  createToken<AuthGuardFactory>("AUTH_GUARD_FACTORY");
export const AUTH_SERVICE = createToken<AuthService>("AUTH_SERVICE");
export const AUTH_CONFIG = createToken<AuthConfig>("AUTH_CONFIG");
export const JWT_SIGNER = createToken<JwtSigner>("JWT_SIGNER");
