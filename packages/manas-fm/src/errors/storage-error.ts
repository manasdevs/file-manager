import { ManasFmError } from "./base-error.js";

/** Thrown when a filesystem storage error occurs (e.g., disk full, I/O failure) */
export class StorageError extends ManasFmError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("STORAGE_ERROR", message, details);
  }
}
