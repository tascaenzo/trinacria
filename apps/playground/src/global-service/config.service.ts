import fs from "node:fs";
import path from "node:path";
import { createToken } from "@trinacria/core";
import { formatValidationError, s, Infer, ValidationError } from "@trinacria/schema";

export const configSchema = s.object({
  // The runtime environment. Affects which security preset is used.
  ENV: s.enum(["development", "staging", "production"]).default("development"),

  // Server configuration
  PORT: s.number({ coerce: true, int: true, min: 1, max: 65535 }).default(5000),
  HOST: s.string().default("localhost"),

  // Database configuration
  DATABASE_URL: s.string(),

  // Swagger/OpenAPI configuration
  OPENAPI_ENABLED: s.boolean({ coerce: true }).default(false),
  SWAGGER_DOCS_USERNAME: s.string().optional(),
  SWAGGER_DOCS_PASSWORD: s.string().optional(),

  // Optional app-level network/auth configuration
  CORS_ALLOWED_ORIGINS: s.array(s.string(), { coerce: true }).default([]),
  AUTH_COOKIE_DOMAIN: s.string().optional(),

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
    const fileNames = [".env", `.env.${currentEnv}`];
    const roots = [process.cwd(), path.join(process.cwd(), "apps/playground")];

    for (const fileName of fileNames) {
      for (const root of roots) {
        const filePath = path.join(root, fileName);
        if (!fs.existsSync(filePath)) {
          continue;
        }

        const data = fs.readFileSync(filePath, "utf8");

        data.split("\n").forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) return;

          const index = trimmed.indexOf("=");
          if (index === -1) return;

          const key = trimmed.slice(0, index).trim();
          const rawValue = trimmed.slice(index + 1).trim();
          const value =
            (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
            (rawValue.startsWith("'") && rawValue.endsWith("'"))
              ? rawValue.slice(1, -1)
              : rawValue;

          process.env[key] = value;
        });
      }
    }
  }

  get<K extends keyof ConfigModel>(key: K): ConfigModel[K] {
    return this.config[key];
  }

  getAll(): ConfigModel {
    return this.config;
  }
}
