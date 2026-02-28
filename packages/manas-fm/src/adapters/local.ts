import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import type { Writable } from "node:stream";
import type {
  StorageAdapter,
  StorageFileStats,
  StorageListItem,
  StorageDirectoryItem,
} from "./storage-adapter.js";
import { wrapFsError } from "../core/fs-utils.js";
import { randomBytes } from "node:crypto";

/**
 * Local file-system storage adapter.
 *
 * Keys are resolved relative to `basePath` using `path.resolve`.
 * This adapter preserves the exact pre-cloud behavior of manas-fm.
 */
export class LocalStorageAdapter implements StorageAdapter {
  readonly type = "local";

  constructor(private readonly basePath: string) {}

  // ─── Helpers ─────────────────────────────────────────────────

  /** Resolve a storage key to an absolute file system path. */
  resolvePath(key: string): string {
    return path.resolve(this.basePath, key);
  }

  /** Convert an absolute path back to a storage key (forward-slash). */
  toKey(absolutePath: string): string {
    return path.relative(this.basePath, absolutePath).split(path.sep).join("/");
  }

  // ─── File Operations ────────────────────────────────────────

  async writeFile(key: string, data: Buffer | string): Promise<void> {
    const filePath = this.resolvePath(key);
    const dir = path.dirname(filePath);
    const tmpPath = path.join(dir, `.tmp-${randomBytes(8).toString("hex")}`);
    try {
      await fsp.mkdir(dir, { recursive: true });
      await fsp.writeFile(tmpPath, data);
      await fsp.rename(tmpPath, filePath);
    } catch (error) {
      try {
        await fsp.unlink(tmpPath);
      } catch {
        // ignore cleanup errors
      }
      throw wrapFsError(error, `Failed to write file: ${filePath}`);
    }
  }

  async readFile(key: string): Promise<Buffer> {
    const filePath = this.resolvePath(key);
    try {
      return await fsp.readFile(filePath);
    } catch (error) {
      throw wrapFsError(error, `Failed to read file: ${filePath}`);
    }
  }

  async deleteFile(key: string): Promise<boolean> {
    const filePath = this.resolvePath(key);
    try {
      await fsp.unlink(filePath);
      return true;
    } catch (error) {
      if (isNodeErrno(error) && error.code === "ENOENT") {
        return false;
      }
      throw wrapFsError(error, `Failed to delete file: ${filePath}`);
    }
  }

  async copyFile(sourceKey: string, destinationKey: string): Promise<void> {
    const src = this.resolvePath(sourceKey);
    const dest = this.resolvePath(destinationKey);
    try {
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await fsp.copyFile(src, dest);
    } catch (error) {
      throw wrapFsError(error, `Failed to copy file from ${src} to ${dest}`);
    }
  }

  async moveFile(sourceKey: string, destinationKey: string): Promise<void> {
    const src = this.resolvePath(sourceKey);
    const dest = this.resolvePath(destinationKey);
    try {
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await fsp.rename(src, dest);
    } catch (error) {
      if (isNodeErrno(error) && error.code === "EXDEV") {
        await this.copyFile(sourceKey, destinationKey);
        await fsp.unlink(src);
        return;
      }
      throw wrapFsError(error, `Failed to move file from ${src} to ${dest}`);
    }
  }

  async fileExists(key: string): Promise<boolean> {
    const filePath = this.resolvePath(key);
    try {
      const stat = await fsp.stat(filePath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  async getFileStats(key: string): Promise<StorageFileStats | null> {
    const filePath = this.resolvePath(key);
    try {
      const stat = await fsp.stat(filePath);
      return { size: stat.size, lastModified: stat.mtime };
    } catch {
      return null;
    }
  }

  // ─── Directory / Listing ────────────────────────────────────

  async listFiles(prefix: string): Promise<StorageListItem[]> {
    const dirPath = this.resolvePath(prefix);
    try {
      const entries = await fsp.readdir(dirPath, { withFileTypes: true });
      const results: StorageListItem[] = [];
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const filePath = path.join(dirPath, entry.name);
        const stat = await fsp.stat(filePath);
        results.push({
          name: entry.name,
          key: this.toKey(filePath),
          size: stat.size,
          lastModified: stat.mtime,
        });
      }
      return results;
    } catch (error) {
      if (isNodeErrno(error) && error.code === "ENOENT") {
        return [];
      }
      throw wrapFsError(error, `Failed to list files in: ${dirPath}`);
    }
  }

  async listDirectories(prefix: string): Promise<StorageDirectoryItem[]> {
    const dirPath = this.resolvePath(prefix);
    try {
      const entries = await fsp.readdir(dirPath, { withFileTypes: true });
      const results: StorageDirectoryItem[] = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        results.push({
          name: entry.name,
          key: this.toKey(path.join(dirPath, entry.name)),
        });
      }
      return results;
    } catch (error) {
      if (isNodeErrno(error) && error.code === "ENOENT") {
        return [];
      }
      throw wrapFsError(error, `Failed to list directories in: ${dirPath}`);
    }
  }

  async ensureDirectory(prefix: string): Promise<void> {
    const dirPath = this.resolvePath(prefix);
    try {
      await fsp.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw wrapFsError(error, `Failed to create directory: ${dirPath}`);
    }
  }

  // ─── Streaming ──────────────────────────────────────────────

  async createWriteStream(key: string): Promise<Writable> {
    const filePath = this.resolvePath(key);
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    return fs.createWriteStream(filePath);
  }

  // ─── URLs ───────────────────────────────────────────────────

  getFileUrl(key: string): string {
    return this.resolvePath(key);
  }
}

function isNodeErrno(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
