/**
 * Minimal logging contract used across the core runtime.
 * Implementations can route logs to console, files, or external transports.
 */
export interface BaseLogger {
  debug(message: string, context?: string): void;
  info(message: string, context?: string): void;
  warn(message: string, context?: string): void;
  error(message: string, error?: unknown, context?: string): void;
}
