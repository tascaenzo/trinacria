import { BaseLogger } from "./logger";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class ConsoleLogger implements BaseLogger {
  private static globalLevel: LogLevel = "debug";
  private static useColors = process.stdout.isTTY;

  constructor(private readonly context?: string) {}

  // --------------------------------------------------
  // CONFIG
  // --------------------------------------------------

  static setLevel(level: LogLevel) {
    ConsoleLogger.globalLevel = level;
  }

  // --------------------------------------------------
  // INTERNAL UTILS
  // --------------------------------------------------

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[ConsoleLogger.globalLevel];
  }

  private getTimestamp(): string {
    const now = new Date();
    return (
      now.toLocaleTimeString("it-IT", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }) +
      "." +
      now.getMilliseconds().toString().padStart(3, "0")
    );
  }

  private color(text: string, code: string): string {
    if (!ConsoleLogger.useColors) return text;
    return `\x1b[${code}m${text}\x1b[0m`;
  }

  private bold(text: string): string {
    return this.color(text, "1");
  }

  private gray(text: string): string {
    return this.color(text, "90");
  }

  private green(text: string): string {
    return this.color(text, "32");
  }

  private yellow(text: string): string {
    return this.color(text, "33");
  }

  private red(text: string): string {
    return this.color(text, "31");
  }

  private cyan(text: string): string {
    return this.color(text, "36");
  }

  private magenta(text: string): string {
    return this.color(text, "35");
  }

  private formatLevel(level: LogLevel): string {
    const label = level.toUpperCase().padEnd(5);

    switch (level) {
      case "debug":
        return this.gray(label);
      case "info":
        return this.green(label);
      case "warn":
        return this.bold(this.yellow(label));
      case "error":
        return this.bold(this.red(label));
    }
  }

  private format(level: LogLevel, message: string, context?: string): string {
    const time = this.gray(this.getTimestamp());
    const framework = this.bold(this.cyan("TRINACRIA"));

    const ctx = context ? this.magenta(context.padEnd(16)) : "".padEnd(16);

    const levelFormatted = this.formatLevel(level);

    return `${time}  ${framework}  ${ctx} ${levelFormatted}  ${message}`;
  }

  // --------------------------------------------------
  // PUBLIC API
  // --------------------------------------------------

  debug(message: string, context = this.context): void {
    if (!this.shouldLog("debug")) return;
    console.log(this.format("debug", message, context));
  }

  info(message: string, context = this.context): void {
    if (!this.shouldLog("info")) return;
    console.log(this.format("info", message, context));
  }

  warn(message: string, context = this.context): void {
    if (!this.shouldLog("warn")) return;
    console.warn(this.format("warn", message, context));
  }

  error(message: string, error?: unknown, context = this.context): void {
    if (!this.shouldLog("error")) return;

    console.error(this.format("error", message, context));

    if (error instanceof Error) {
      console.error(error.stack);
    } else if (error) {
      console.error(error);
    }
  }
}
