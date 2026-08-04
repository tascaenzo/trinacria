import path from "node:path";
import { createToken, loadEnvironmentFiles } from "@trinacria/core";
import {
  formatValidationError,
  type Infer,
  s,
  ValidationError,
} from "@trinacria/schema";

export const configSchema = s.object({
  // The runtime environment. Affects which security preset is used.
  ENV: s.enum(["development", "staging", "production"]).default("development"),

  // Server configuration
  PORT: s.number({ coerce: true, int: true, min: 1, max: 65535 }).default(5000),
  HOST: s.string().default("localhost"),
  TRUST_PROXY: s.boolean({ coerce: true }).default(false),

  // Database configuration
  DATABASE_URL: s.string(),

  // Swagger/OpenAPI configuration
  OPENAPI_ENABLED: s.boolean({ coerce: true }).default(false),
  SWAGGER_DOCS_USERNAME: s.string().optional(),
  SWAGGER_DOCS_PASSWORD: s.string().optional(),

  // Optional app-level network/auth configuration
  CORS_ALLOWED_ORIGINS: s.array(s.string(), { coerce: true }).default([]),
  AUTH_COOKIE_DOMAIN: s.string().optional(),

  // Playground cron plugin configuration
  CRON_ENABLED: s.boolean({ coerce: true }).default(true),
  CRON_TICK_MS: s
    .number({ coerce: true, int: true, min: 100, max: 60_000 })
    .default(1_000),
  CRON_LOCK_TTL_MS: s
    .number({ coerce: true, int: true, min: 1_000, max: 300_000 })
    .default(30_000),

  // Secret key for signing JWTs or other secrets (use a secure key in production)
  SECRET_KEY: s.string(),
  JWT_ACCESS_TOKEN_TTL_SECONDS: s
    .number({ coerce: true, int: true, positive: true })
    .default(900),
  JWT_REFRESH_TOKEN_TTL_SECONDS: s
    .number({ coerce: true, int: true, positive: true })
    .default(1_209_600),
});

export type ConfigModel = Infer<typeof configSchema>;
export const CONFIG_VALIDATION_EXIT_CODE = 78;
export const CONFIG_SERVICE = createToken<ConfigService>("CONFIG_SERVICE");

export class ConfigService {
  private config!: ConfigModel;

  constructor() {
    this.loadEnvFile();
    try {
      this.config = configSchema.parse(process.env);
      this.assertProductionSafety();
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new Error(
          formatValidationError(error, {
            prefix: "Invalid environment configuration:",
          }),
        );
      }

      throw error;
    }
  }

  private loadEnvFile() {
    const currentEnv = process.env.ENV || "development";
    const roots = [process.cwd(), path.join(process.cwd(), "apps/playground")];
    loadEnvironmentFiles({ roots, environment: currentEnv });
  }

  private assertProductionSafety(): void {
    if (this.config.ENV === "development") return;

    const secret = this.config.SECRET_KEY;
    const forbidden = new Set([
      "replace-with-a-strong-secret",
      "change-me",
      "secret",
      "password",
    ]);
    if (Buffer.byteLength(secret, "utf8") < 32 || forbidden.has(secret)) {
      throw new Error(
        "Invalid environment configuration: SECRET_KEY must contain at least 32 bytes of non-placeholder material outside development",
      );
    }

    if (this.config.CORS_ALLOWED_ORIGINS.length === 0) {
      throw new Error(
        "Invalid environment configuration: CORS_ALLOWED_ORIGINS must be explicit outside development",
      );
    }

    if (
      this.config.OPENAPI_ENABLED &&
      (!this.config.SWAGGER_DOCS_USERNAME ||
        !this.config.SWAGGER_DOCS_PASSWORD ||
        this.config.SWAGGER_DOCS_PASSWORD.length < 16)
    ) {
      throw new Error(
        "Invalid environment configuration: non-development API docs require a username and a password of at least 16 characters",
      );
    }
  }

  get<K extends keyof ConfigModel>(key: K): ConfigModel[K] {
    return this.config[key];
  }

  getAll(): ConfigModel {
    return this.config;
  }
}
