import { ConsoleLogger } from "./console-logger";

/**
 * Static logger facade used by the core internals.
 * It allows replacing the default logger implementation at bootstrap time.
 */
export class CoreLog {
  private static logger: ConsoleLogger = new ConsoleLogger("core");

  /**
   * Replaces the logger used by CoreLog.
   * The optional context parameter is kept for API compatibility.
   */
  static setLogger(logger: ConsoleLogger, context?: string): void {
    this.logger = logger;
  }

  /**
   * Emits a debug-level log through the configured logger.
   */
  static debug(msg: string, context?: string): void {
    this.logger.debug(msg, context);
  }

  /**
   * Emits an info-level log through the configured logger.
   */
  static info(msg: string, context?: string): void {
    this.logger.info(msg, context);
  }

  /**
   * Emits a warn-level log through the configured logger.
   */
  static warn(msg: string, context?: string): void {
    this.logger.warn(msg, context);
  }

  /**
   * Emits an error-level log through the configured logger.
   */
  static error(msg: string, err?: unknown, context?: string): void {
    this.logger.error(msg, err, context);
  }
}
