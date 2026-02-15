import { ManasFmError } from "./base-error.js";

/** Thrown when configuration is invalid */
export class ConfigError extends ManasFmError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("CONFIG_ERROR", message, details);
  }
}
