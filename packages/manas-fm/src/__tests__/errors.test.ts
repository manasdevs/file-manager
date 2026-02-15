import { describe, it, expect } from "vitest";
import {
  ManasFmError,
  ConfigError,
  ValidationError,
  FileNotFoundError,
  PermissionError,
  StorageError,
  OperationError,
} from "../errors/index.js";

describe("Error classes", () => {
  it("ConfigError has correct code and message", () => {
    const err = new ConfigError("bad config");
    expect(err.code).toBe("CONFIG_ERROR");
    expect(err.message).toBe("bad config");
    expect(err.name).toBe("ConfigError");
    expect(err).toBeInstanceOf(ManasFmError);
    expect(err).toBeInstanceOf(Error);
  });

  it("ValidationError has correct code", () => {
    const err = new ValidationError("invalid input", { field: "size" });
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.details).toEqual({ field: "size" });
  });

  it("FileNotFoundError has correct code", () => {
    const err = new FileNotFoundError("not found");
    expect(err.code).toBe("FILE_NOT_FOUND");
  });

  it("PermissionError has correct code", () => {
    const err = new PermissionError("denied");
    expect(err.code).toBe("PERMISSION_ERROR");
  });

  it("StorageError has correct code", () => {
    const err = new StorageError("disk full");
    expect(err.code).toBe("STORAGE_ERROR");
  });

  it("OperationError has correct code", () => {
    const err = new OperationError("conflict");
    expect(err.code).toBe("OPERATION_ERROR");
  });

  it("all errors have proper prototype chain", () => {
    const errors = [
      new ConfigError("test"),
      new ValidationError("test"),
      new FileNotFoundError("test"),
      new PermissionError("test"),
      new StorageError("test"),
      new OperationError("test"),
    ];
    for (const err of errors) {
      expect(err).toBeInstanceOf(ManasFmError);
      expect(err).toBeInstanceOf(Error);
    }
  });
});
