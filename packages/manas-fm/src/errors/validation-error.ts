import { ManasFmError } from "./base-error.js";

/** Thrown when input validation fails (e.g., invalid slug, file type, file size) */
export class ValidationError extends ManasFmError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("VALIDATION_ERROR", message, details);
  }
}
