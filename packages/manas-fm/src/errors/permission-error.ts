import { ManasFmError } from "./base-error.js";

/** Thrown when a filesystem permission error occurs or path traversal is detected */
export class PermissionError extends ManasFmError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("PERMISSION_ERROR", message, details);
  }
}
