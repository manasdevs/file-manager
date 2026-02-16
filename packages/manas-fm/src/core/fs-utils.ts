import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import type { Stats } from "node:fs";
import { FileNotFoundError } from "../errors/file-not-found-error.js";
import { PermissionError } from "../errors/permission-error.js";
import { StorageError } from "../errors/storage-error.js";
import type { ManasFmError } from "../errors/base-error.js";
import type { FileNamingStrategy } from "../types/config.js";

/** Write file atomically: write to temp file then rename */
export async function atomicWriteFile(filePath: string, data: Buffer | string): Promise<void> {
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.tmp-${randomBytes(8).toString("hex")}`);
  try {
    await fs.writeFile(tmpPath, data);
    await fs.rename(tmpPath, filePath);
  } catch (error) {
    try {
      await fs.unlink(tmpPath);
    } catch {
      // Ignore cleanup errors
    }
    throw wrapFsError(error, `Failed to write file: ${filePath}`);
  }
}

/** Ensure a directory exists (mkdir -p equivalent) */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    throw wrapFsError(error, `Failed to create directory: ${dirPath}`);
  }
}

/** Safe delete: unlink with ENOENT grace. Returns true if file was deleted, false if not found. */
export async function safeDeleteFile(filePath: string): Promise<boolean> {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }
    throw wrapFsError(error, `Failed to delete file: ${filePath}`);
  }
}

/** Copy a file, ensuring the destination directory exists */
export async function copyFile(source: string, destination: string): Promise<void> {
  try {
    await ensureDirectory(path.dirname(destination));
    await fs.copyFile(source, destination);
  } catch (error) {
    throw wrapFsError(error, `Failed to copy file from ${source} to ${destination}`);
  }
}

/** Move a file (rename, falling back to copy+delete for cross-device) */
export async function moveFile(source: string, destination: string): Promise<void> {
  try {
    await ensureDirectory(path.dirname(destination));
    await fs.rename(source, destination);
  } catch (error) {
    if (isNodeError(error) && error.code === "EXDEV") {
      await copyFile(source, destination);
      await fs.unlink(source);
      return;
    }
    throw wrapFsError(error, `Failed to move file from ${source} to ${destination}`);
  }
}

/** Read a file into a Buffer */
export async function readFileBuffer(filePath: string): Promise<Buffer> {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    throw wrapFsError(error, `Failed to read file: ${filePath}`);
  }
}

/** Check if a path exists and is a file */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

/** Check if a path exists and is a directory */
export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/** Get file stats, returning null if file doesn't exist */
export async function getFileStats(filePath: string): Promise<Stats | null> {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

/** Generate a unique filename if conflict exists: photo.jpg -> photo-1.jpg */
export function generateUniqueName(baseName: string, existingNames: Set<string>): string {
  if (!existingNames.has(baseName)) {
    return baseName;
  }

  const ext = path.extname(baseName);
  const nameWithoutExt = baseName.slice(0, baseName.length - ext.length);

  let counter = 1;
  let candidate: string;
  do {
    candidate = `${nameWithoutExt}-${counter}${ext}`;
    counter++;
  } while (existingNames.has(candidate));

  return candidate;
}

/** Sanitize a filename by removing path separators and control characters */
export function sanitizeFileName(name: string): string {
  // Remove path separators and null bytes
  let sanitized = name.replace(/[/\\:\0]/g, "");
  // Remove leading dots to prevent hidden files / directory traversal
  sanitized = sanitized.replace(/^\.+/, "");
  // Trim whitespace
  sanitized = sanitized.trim();
  // Fallback if name is empty after sanitization
  if (sanitized.length === 0) {
    sanitized = "unnamed";
  }
  return sanitized;
}

/** Format a Date into a file-safe timestamp string: YYYYMMDD-HHmmss (UTC) */
export function formatTimestamp(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const sec = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}-${h}${min}${sec}`;
}

/** Generate a file name according to the given naming strategy */
export function generateFileName(
  originalName: string,
  strategy: FileNamingStrategy,
  existingNames: Set<string>,
): string {
  const sanitized = sanitizeFileName(originalName);

  if (strategy === "original") {
    return sanitized;
  }

  const ext = path.extname(sanitized);
  const nameWithoutExt = sanitized.slice(0, sanitized.length - ext.length);

  let candidate: string;

  switch (strategy) {
    case "uuid": {
      candidate = `${randomUUID()}${ext}`;
      break;
    }

    case "name-uuid": {
      const shortUuid = randomUUID().split("-")[0];
      candidate = `${nameWithoutExt}-${shortUuid}${ext}`;
      break;
    }

    case "name-number": {
      let counter = 1;
      do {
        candidate = `${nameWithoutExt}-${counter}${ext}`;
        counter++;
      } while (existingNames.has(candidate));
      return candidate;
    }

    case "name-timestamp": {
      const ts = formatTimestamp(new Date());
      candidate = `${nameWithoutExt}-${ts}${ext}`;
      break;
    }

    case "timestamp": {
      const ts = formatTimestamp(new Date());
      candidate = `${ts}${ext}`;
      break;
    }

    default:
      return sanitized;
  }

  // Collision fallback for uuid/timestamp strategies
  if (existingNames.has(candidate)) {
    return generateUniqueName(candidate, existingNames);
  }

  return candidate;
}

/** Map filesystem error codes to ManasFmError subclasses */
export function wrapFsError(error: unknown, context: string): ManasFmError {
  if (isNodeError(error)) {
    switch (error.code) {
      case "EACCES":
      case "EPERM":
        return new PermissionError(`${context}: permission denied`, {
          originalCode: error.code,
        });
      case "ENOENT":
        return new FileNotFoundError(`${context}: file or directory not found`, {
          originalCode: error.code,
        });
      case "ENOSPC":
        return new StorageError(`${context}: no space left on device`, {
          originalCode: error.code,
        });
      default:
        return new StorageError(`${context}: ${error.message}`, {
          originalCode: error.code,
        });
    }
  }
  return new StorageError(`${context}: ${error instanceof Error ? error.message : String(error)}`);
}

export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
