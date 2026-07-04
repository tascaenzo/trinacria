import fs from "node:fs";
import path from "node:path";
import { createToken } from "@trinacria/core";
import {
  formatValidationError,
  Infer,
  s,
  ValidationError,
} from "@trinacria/schema";

export const configSchema = s.object({
  ENV: s.enum(["development", "staging", "production"]).default("development"),
  PORT: s.number({ coerce: true, int: true, min: 1, max: 65535 }).default(4002),
  HOST: s.string().default("127.0.0.1"),
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
    const roots = [
      process.cwd(),
      path.join(process.cwd(), "apps/api-mongoose-mongodb"),
    ];

    fileNames.forEach((fileName) => {
      roots.forEach((root) => {
        const filePath = path.join(root, fileName);
        if (!fs.existsSync(filePath)) {
          return;
        }

        const data = fs.readFileSync(filePath, "utf8");
        data.split("\n").forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) {
            return;
          }

          const separatorIndex = trimmed.indexOf("=");
          if (separatorIndex === -1) {
            return;
          }

          const key = trimmed.slice(0, separatorIndex).trim();
          const rawValue = trimmed.slice(separatorIndex + 1).trim();
          const value =
            (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
            (rawValue.startsWith("'") && rawValue.endsWith("'"))
              ? rawValue.slice(1, -1)
              : rawValue;

          process.env[key] = value;
        });
      });
    });
  }

  get<K extends keyof ConfigModel>(key: K): ConfigModel[K] {
    return this.config[key];
  }

  getAll(): ConfigModel {
    return this.config;
  }
}
