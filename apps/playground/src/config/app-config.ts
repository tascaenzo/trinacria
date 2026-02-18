import fs from "node:fs";
import path from "node:path";
import { s, type Infer, ValidationError } from "@trinacria/schema";

export const CONFIG_VALIDATION_EXIT_CODE = 78;

/**
 * Runtime configuration schema validated at application startup.
 * Values come from `process.env`.
 */
export const AppConfigSchema = s.object(
  {
    HOST: s.string({ trim: true, minLength: 1 }).default("0.0.0.0"),
    PORT: s.number({ coerce: true }).default(5000),
  },
  { strict: false },
);

export type AppConfig = Infer<typeof AppConfigSchema>;

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const fileEnv = loadEnvFile(".env.development");
  const mergedEnv: NodeJS.ProcessEnv = { ...fileEnv, ...env };

  try {
    return AppConfigSchema.parse(mergedEnv);
  } catch (error) {
    if (error instanceof ValidationError) {
      const details = error.issues
        .map((issue) => {
          const path = issue.path.map(String).join(".");
          return `${path || "<root>"}: ${issue.message}`;
        })
        .join("; ");

      throw new Error(`Invalid environment configuration: ${details}`);
    }

    throw error;
  }
}

function loadEnvFile(fileName: string): NodeJS.ProcessEnv {
  const possiblePaths = [
    path.resolve(process.cwd(), fileName),
    path.resolve(process.cwd(), "apps/playground", fileName),
  ];

  for (const filePath of possiblePaths) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    return parseEnvFile(fs.readFileSync(filePath, "utf8"));
  }

  return {};
}

function parseEnvFile(content: string): NodeJS.ProcessEnv {
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
