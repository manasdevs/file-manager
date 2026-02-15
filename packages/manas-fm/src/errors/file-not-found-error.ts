import { ManasFmError } from "./base-error.js";

/** Thrown when a requested file or directory does not exist */
export class FileNotFoundError extends ManasFmError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("FILE_NOT_FOUND", message, details);
  }
}
