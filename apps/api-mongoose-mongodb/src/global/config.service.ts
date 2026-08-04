import path from "node:path";
import { createToken, loadEnvironmentFiles } from "@trinacria/core";
import {
  formatValidationError,
  type Infer,
  s,
  ValidationError,
} from "@trinacria/schema";

export const configSchema = s.object({
  ENV: s.enum(["development", "staging", "production"]).default("development"),
  PORT: s.number({ coerce: true, int: true, min: 1, max: 65535 }).default(4002),
  HOST: s.string().default("127.0.0.1"),
  TRUST_PROXY: s.boolean({ coerce: true }).default(false),
  DATABASE_URL: s.string(),
  OPENAPI_ENABLED: s.boolean({ coerce: true }).default(true),
  CORS_ALLOWED_ORIGINS: s.array(s.string(), { coerce: true }).default([]),
});

export type ConfigModel = Infer<typeof configSchema>;
export const CONFIG_SERVICE = createToken<ConfigService>("CONFIG_SERVICE");

export class ConfigService {
  private readonly config: ConfigModel;

  constructor() {
    this.loadEnvFile();

    try {
      this.config = configSchema.parse(process.env);
      if (this.config.ENV === "production" && this.config.OPENAPI_ENABLED) {
        throw new Error("OPENAPI_ENABLED must be false in production examples");
      }
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
    const roots = [
      process.cwd(),
      path.join(process.cwd(), "apps/api-mongoose-mongodb"),
    ];

    loadEnvironmentFiles({ roots, environment: currentEnv });
  }

  get<K extends keyof ConfigModel>(key: K): ConfigModel[K] {
    return this.config[key];
  }

  getAll(): ConfigModel {
    return this.config;
  }
}
