import { CACHE_LIMIT } from "./constants";

const CSP_CACHE = new Map<string, string>();
const HEADER_ENTRIES_CACHE = new Map<string, Array<[string, string]>>();

export function getCachedCspValue(key: string, factory: () => string): string {
  return getCachedValue(CSP_CACHE, key, factory);
}

export function getCachedHeaderEntries(
  key: string,
  factory: () => Array<[string, string]>,
): Array<[string, string]> {
  return getCachedValue(HEADER_ENTRIES_CACHE, key, factory);
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (key) =>
          `${key}:${stableStringify((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function getCachedValue<T>(
  cache: Map<string, T>,
  key: string,
  factory: () => T,
): T {
  const existing = cache.get(key);
  if (existing !== undefined) {
    return existing;
  }

  const created = factory();
  cache.set(key, created);

  if (cache.size > CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  return created;
}
