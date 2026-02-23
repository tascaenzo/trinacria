import test from "node:test";
import assert from "node:assert/strict";

import {
  matchesCronExpression,
  parseCronExpression,
} from "../src/scheduler/cron-expression";

test("parseCronExpression supports wildcard, ranges, lists and steps", () => {
  const parsed = parseCronExpression("*/15 9-17 * * 1,3,5");

  assert.equal(matchesCronExpression(parsed, new Date(2026, 1, 23, 9, 0)), true);
  assert.equal(matchesCronExpression(parsed, new Date(2026, 1, 23, 9, 15)), true);
  assert.equal(matchesCronExpression(parsed, new Date(2026, 1, 23, 9, 10)), false);
  assert.equal(matchesCronExpression(parsed, new Date(2026, 1, 24, 9, 0)), false);
  assert.equal(matchesCronExpression(parsed, new Date(2026, 1, 23, 18, 0)), false);
});

test("parseCronExpression throws for invalid field count", () => {
  assert.throws(() => parseCronExpression("* * *"), /5 fields/);
});

test("parseCronExpression throws for invalid step and range", () => {
  assert.throws(() => parseCronExpression("*/0 * * * *"), /Step must be > 0/);
  assert.throws(() => parseCronExpression("* 25 * * *"), /out of range/);
  assert.throws(() => parseCronExpression("* * * * 8"), /out of range/);
});
