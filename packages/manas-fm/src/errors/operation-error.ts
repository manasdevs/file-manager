import { ManasFmError } from "./base-error.js";

/** Thrown when a file operation fails (e.g., file already exists, rename conflict) */
export class OperationError extends ManasFmError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("OPERATION_ERROR", message, details);
  }
}
