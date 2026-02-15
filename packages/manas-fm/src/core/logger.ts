import * as fs from "node:fs/promises";
import * as path from "node:path";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private readonly enabled: boolean;
  private readonly level: LogLevel;
  private readonly logFilePath: string | undefined;
  private logDirEnsured = false;

  constructor(config: { enabled: boolean; level: LogLevel; filePath?: string; basePath?: string }) {
    this.enabled = config.enabled;
    this.level = config.level;
    if (config.filePath && config.basePath) {
      this.logFilePath = path.isAbsolute(config.filePath)
        ? config.filePath
        : path.join(config.basePath, config.filePath);
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log("error", message, context);
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (!this.enabled) return;
    if (LOG_LEVELS[level] < LOG_LEVELS[this.level]) return;

    const timestamp = new Date().toISOString();
    const prefix = `[manas-fm][${level.toUpperCase()}][${timestamp}]`;
    const logMessage = context
      ? `${prefix} ${message} ${JSON.stringify(context)}`
      : `${prefix} ${message}`;

    switch (level) {
      case "debug":
        console.debug(logMessage);
        break;
      case "info":
        console.info(logMessage);
        break;
      case "warn":
        console.warn(logMessage);
        break;
      case "error":
        console.error(logMessage);
        break;
    }

    if (this.logFilePath) {
      const entry = JSON.stringify({ timestamp, level, message, ...context }) + "\n";
      this.appendToFile(entry).catch(() => {
        // Swallow file logging errors silently
      });
    }
  }

  private async appendToFile(entry: string): Promise<void> {
    if (!this.logFilePath) return;
    if (!this.logDirEnsured) {
      await fs.mkdir(path.dirname(this.logFilePath), { recursive: true });
      this.logDirEnsured = true;
    }
    await fs.appendFile(this.logFilePath, entry);
  }
}
