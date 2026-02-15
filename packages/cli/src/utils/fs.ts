import * as fs from "node:fs";
import * as path from "node:path";
import { success, warn } from "./logger.js";

/**
 * Write a file, creating directories as needed.
 * If file already exists, skip unless overwrite is true.
 */
export function writeFileSafe(
  filePath: string,
  content: string,
  overwrite = false,
): boolean {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(filePath) && !overwrite) {
    warn(`Skipped (already exists): ${path.relative(process.cwd(), filePath)}`);
    return false;
  }

  fs.writeFileSync(filePath, content, "utf-8");
  success(`Created: ${path.relative(process.cwd(), filePath)}`);
  return true;
}

/**
 * Ensure a directory exists.
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
