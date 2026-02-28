import { createToken } from "@trinacria/core";

export interface AppConfig {
  readonly CRON_ENABLED: boolean;
  readonly CRON_TICK_MS: number;
  readonly HEARTBEAT_INTERVAL_MS: number;
}

export const CONFIG_SERVICE = createToken<ConfigService>(
  "CRON_EXAMPLE_CONFIG_SERVICE",
);

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === "") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (value == null || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

export class ConfigService {
  getAll(): AppConfig {
    return {
      CRON_ENABLED: parseBoolean(process.env.CRON_ENABLED, true),
      CRON_TICK_MS: parseNumber(process.env.CRON_TICK_MS, 1_000),
      HEARTBEAT_INTERVAL_MS: parseNumber(
        process.env.HEARTBEAT_INTERVAL_MS,
        10_000,
      ),
    };
  }
}
