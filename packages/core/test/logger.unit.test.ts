import test from "node:test";
import assert from "node:assert/strict";
import { ConsoleLogger } from "../src/logger/console-logger.ts";
import { CoreLog } from "../src/logger/core-logger.ts";

test("console logger respects global level filtering", () => {
  const logs: string[] = [];
  const originalLog = console.log;

  console.log = (...args: unknown[]) => {
    logs.push(String(args[0] ?? ""));
  };

  try {
    ConsoleLogger.setLevel("warn");
    ConsoleLogger.setLocale("en-US");
    (ConsoleLogger as any).useColors = false;

    const logger = new ConsoleLogger("ctx");
    logger.debug("debug hidden");
    logger.info("info hidden");
    logger.warn("warn shown");

    assert.equal(logs.length, 0);
  } finally {
    console.log = originalLog;
    ConsoleLogger.setLevel("debug");
  }
});

test("console logger error handles Error and non-Error payloads", () => {
  const errors: string[] = [];
  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = (...args: unknown[]) => {
    errors.push(String(args[0] ?? ""));
  };
  console.warn = (...args: unknown[]) => {
    errors.push(String(args[0] ?? ""));
  };

  try {
    ConsoleLogger.setLevel("debug");
    (ConsoleLogger as any).useColors = true;

    const logger = new ConsoleLogger("logger-test");
    logger.error("error with stack", new Error("boom"));
    logger.error("error with object", { code: 123 });
    logger.warn("warn line");

    assert.equal(
      errors.some((line) => line.includes("error with stack")),
      true,
    );
    assert.equal(
      errors.some((line) => line.includes("Error: boom")),
      true,
    );
    assert.equal(
      errors.some((line) => line.includes("error with object")),
      true,
    );
    assert.equal(
      errors.some((line) => line.includes("warn line")),
      true,
    );
    assert.equal(
      errors.some((line) => line.includes("\x1b[")),
      true,
    );
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
});

test("core logger forwards debug/info/warn/error to configured logger", () => {
  const calls: string[] = [];

  class CaptureLogger extends ConsoleLogger {
    override debug(msg: string): void {
      calls.push(`debug:${msg}`);
    }
    override info(msg: string): void {
      calls.push(`info:${msg}`);
    }
    override warn(msg: string): void {
      calls.push(`warn:${msg}`);
    }
    override error(msg: string, err?: unknown): void {
      calls.push(
        `error:${msg}:${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  CoreLog.setLogger(new CaptureLogger("capture"));
  CoreLog.debug("d");
  CoreLog.info("i");
  CoreLog.warn("w");
  CoreLog.error("e", new Error("x"));

  assert.deepEqual(calls, ["debug:d", "info:i", "warn:w", "error:e:x"]);
});
