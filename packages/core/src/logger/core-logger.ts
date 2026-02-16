import { ConsoleLogger } from "./console-logger";

export class CoreLog {
  private static logger: ConsoleLogger = new ConsoleLogger("core");

  static setLogger(logger: ConsoleLogger, context?: string): void {
    this.logger = logger;
  }

  static debug(msg: string, context?: string): void {
    this.logger.debug(msg, context);
  }

  static info(msg: string, context?: string): void {
    this.logger.info(msg, context);
  }

  static warn(msg: string, context?: string): void {
    this.logger.warn(msg, context);
  }

  static error(msg: string, err?: unknown, context?: string): void {
    this.logger.error(msg, err, context);
  }
}
