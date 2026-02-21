import fs from "node:fs";
import path from "node:path";
import { createToken } from "@trinacria/core";
import { Infer, ValidationError, s } from "@trinacria/schema";

export const CONFIG_VALIDATION_EXIT_CODE = 78;
const DEVELOPMENT_JWT_SECRET = "trinacria-playground-dev-secret-change-me";

export const appConfigSchema = s.object({
  NODE_ENV: s
    .enum(["development", "staging", "production"] as const)
    .default("development"),

  HOST: s.string().default("0.0.0.0"),

  PORT: s.number({ coerce: true, int: true, min: 1 }).default(5000),

  DATABASE_URL: s.string(),

  OPENAPI_ENABLED: s.boolean({ coerce: true }).default(false),

  TRUST_PROXY: s.boolean({ coerce: true }).default(false),

  CORS_ALLOWED_ORIGINS: s.string().optional(),

  JWT_SECRET: s.string({ minLength: 32 }).optional(),

  JWT_ACCESS_TOKEN_TTL_SECONDS: s
    .number({ coerce: true, int: true, positive: true })
    .default(900),

  JWT_REFRESH_TOKEN_TTL_SECONDS: s
    .number({ coerce: true, int: true, positive: true })
    .default(1_209_600),

  AUTH_COOKIE_DOMAIN: s.string().optional(),
});

type ParsedAppConfig = Infer<typeof appConfigSchema>;
export type RuntimeEnv = ParsedAppConfig["NODE_ENV"];

export interface AppConfig
  extends Omit<ParsedAppConfig, "CORS_ALLOWED_ORIGINS" | "JWT_SECRET"> {
  CORS_ALLOWED_ORIGINS: string[];
  JWT_SECRET: string;
}

export const APP_CONFIG = createToken<AppConfig>("APP_CONFIG");

export function loadAppConfig(env: unknown = process.env): AppConfig {
  const envSource = asProcessEnv(env);
  const nodeEnv = normalizeNodeEnv(envSource.NODE_ENV);
  const fileEnv = loadEnv(nodeEnv);
  const mergedEnv = { ...fileEnv, ...envSource };

  let parsed: ParsedAppConfig;
  try {
    parsed = appConfigSchema.parse(mergedEnv);
  } catch (error) {
    if (error instanceof ValidationError) {
      const firstIssue = error.issues[0];
      const path = firstIssue?.path?.map(String).join(".");
      const message = path
        ? `Invalid environment configuration: ${path} ${firstIssue.message}`
        : `Invalid environment configuration: ${firstIssue?.message ?? "Invalid input"}`;
      throw new Error(message);
    }

    throw error;
  }

  if (parsed.NODE_ENV === "production" && !parsed.JWT_SECRET) {
    throw new Error("Invalid environment configuration: JWT_SECRET is required in production");
  }

  if (
    parsed.JWT_REFRESH_TOKEN_TTL_SECONDS <= parsed.JWT_ACCESS_TOKEN_TTL_SECONDS
  ) {
    throw new Error(
      "Invalid environment configuration: JWT_REFRESH_TOKEN_TTL_SECONDS must be greater than JWT_ACCESS_TOKEN_TTL_SECONDS",
    );
  }

  return {
    ...parsed,
    JWT_SECRET: parsed.JWT_SECRET ?? DEVELOPMENT_JWT_SECRET,
    CORS_ALLOWED_ORIGINS: parsed.CORS_ALLOWED_ORIGINS
      ? parsed.CORS_ALLOWED_ORIGINS.split(",")
          .map((v: string) => v.trim())
          .filter(Boolean)
      : [],
  };
}

function asProcessEnv(env: unknown): NodeJS.ProcessEnv {
  if (!env || typeof env !== "object") {
    return {};
  }

  return env as NodeJS.ProcessEnv;
}

function normalizeNodeEnv(value: string | undefined): RuntimeEnv {
  if (value === "production" || value === "staging" || value === "development") {
    return value;
  }
  return "development";
}

function loadEnv(nodeEnv: RuntimeEnv): NodeJS.ProcessEnv {
  const base = loadEnvFile(".env");
  const mode = loadEnvFile(`.env.${nodeEnv}`);
  return { ...base, ...mode };
}

function loadEnvFile(fileName: string): NodeJS.ProcessEnv {
  const candidates = [
    path.resolve(process.cwd(), fileName),
    path.resolve(process.cwd(), "apps/playground", fileName),
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) {
      continue;
    }
    return parseEnvContent(fs.readFileSync(filePath, "utf8"));
  }

  return {};
}

function parseEnvContent(content: string): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    result[key] = stripWrappingQuotes(rawValue);
  }

  return result;
}

function stripWrappingQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
