interface CronField {
  readonly any: boolean;
  readonly values: Set<number>;
}

/**
 * Parsed representation of a five-field cron expression.
 */
export interface ParsedCronExpression {
  readonly minute: CronField;
  readonly hour: CronField;
  readonly dayOfMonth: CronField;
  readonly month: CronField;
  readonly dayOfWeek: CronField;
}

const FIELD_CONFIG = [
  { min: 0, max: 59, name: "minute" },
  { min: 0, max: 23, name: "hour" },
  { min: 1, max: 31, name: "dayOfMonth" },
  { min: 1, max: 12, name: "month" },
  { min: 0, max: 6, name: "dayOfWeek" },
] as const;

/**
 * Parses a standard five-field cron expression:
 * minute hour dayOfMonth month dayOfWeek
 */
export function parseCronExpression(expression: string): ParsedCronExpression {
  const normalized = expression.trim().replace(/\s+/g, " ");
  const parts = normalized.split(" ");
  if (parts.length !== 5) {
    throw new Error(
      `Cron expression must have 5 fields, received ${parts.length}: "${expression}"`,
    );
  }

  const fields = parts.map((part, index) => {
    const config = FIELD_CONFIG[index];
    return parseField(part, config.min, config.max, config.name);
  });

  return {
    minute: fields[0],
    hour: fields[1],
    dayOfMonth: fields[2],
    month: fields[3],
    dayOfWeek: fields[4],
  };
}

export function matchesCronExpression(
  parsed: ParsedCronExpression,
  date: Date,
): boolean {
  return (
    matchesField(parsed.minute, date.getMinutes()) &&
    matchesField(parsed.hour, date.getHours()) &&
    matchesField(parsed.dayOfMonth, date.getDate()) &&
    matchesField(parsed.month, date.getMonth() + 1) &&
    matchesField(parsed.dayOfWeek, date.getDay())
  );
}

function parseField(
  rawField: string,
  min: number,
  max: number,
  name: string,
): CronField {
  const field = rawField.trim();

  if (field === "*") {
    return { any: true, values: new Set<number>() };
  }

  const values = new Set<number>();
  const parts = field.split(",");

  for (const part of parts) {
    const trimmedPart = part.trim();
    if (trimmedPart.length === 0) {
      throw new Error(`Invalid ${name} field "${rawField}"`);
    }

    addPartValues(trimmedPart, min, max, name, values);
  }

  return { any: false, values };
}

function addPartValues(
  part: string,
  min: number,
  max: number,
  name: string,
  values: Set<number>,
): void {
  const [rangePart, stepPart] = part.split("/");
  if (stepPart !== undefined && stepPart.length === 0) {
    throw new Error(`Invalid step in ${name} field: "${part}"`);
  }

  const step = stepPart === undefined ? 1 : parseNumeric(stepPart, name, part);
  if (step <= 0) {
    throw new Error(`Step must be > 0 in ${name} field: "${part}"`);
  }

  if (rangePart === "*") {
    for (let value = min; value <= max; value += step) {
      values.add(value);
    }
    return;
  }

  const rangeMatch = rangePart.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const start = parseNumeric(rangeMatch[1], name, part);
    const end = parseNumeric(rangeMatch[2], name, part);

    ensureInRange(start, min, max, name, part);
    ensureInRange(end, min, max, name, part);

    if (start > end) {
      throw new Error(`Invalid range in ${name} field: "${part}"`);
    }

    for (let value = start; value <= end; value += step) {
      values.add(value);
    }
    return;
  }

  const single = parseNumeric(rangePart, name, part);
  ensureInRange(single, min, max, name, part);
  values.add(single);
}

function parseNumeric(raw: string, name: string, part: string): number {
  if (!/^\d+$/.test(raw)) {
    throw new Error(`Invalid ${name} field segment "${part}"`);
  }
  return Number(raw);
}

function ensureInRange(
  value: number,
  min: number,
  max: number,
  name: string,
  part: string,
): void {
  if (value < min || value > max) {
    throw new Error(
      `Value ${value} out of range for ${name} field (${min}-${max}) in "${part}"`,
    );
  }
}

function matchesField(field: CronField, value: number): boolean {
  return field.any || field.values.has(value);
}
