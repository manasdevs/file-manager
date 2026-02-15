import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { MetadataIndex, FileMetadataEntry } from "../types/internal.js";
import type { PathResolver } from "./path-resolver.js";
import type { Logger } from "./logger.js";
import { atomicWriteFile, ensureDirectory, isNodeError } from "./fs-utils.js";

export class MetadataManager {
  /** Per-directory lock to serialize writes */
  private locks: Map<string, Promise<void>> = new Map();

  constructor(
    private readonly pathResolver: PathResolver,
    private readonly logger: Logger,
  ) {}

  /** Read the metadata index for a directory. Returns empty structure if none exists. */
  async readIndex(dirPath: string): Promise<MetadataIndex> {
    const metaPath = this.pathResolver.getMetadataPath(dirPath);
    try {
      const content = await fs.readFile(metaPath, "utf-8");
      return JSON.parse(content) as MetadataIndex;
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return { files: {} };
      }
      this.logger.warn("Corrupted metadata file, starting fresh", { path: metaPath });
      return { files: {} };
    }
  }

  /** Write the full metadata index for a directory (atomic write). */
  async writeIndex(dirPath: string, index: MetadataIndex): Promise<void> {
    const metaPath = this.pathResolver.getMetadataPath(dirPath);
    await ensureDirectory(dirPath);
    await atomicWriteFile(metaPath, JSON.stringify(index, null, 2));
  }

  /** Add or update metadata for a single file entry (with per-directory locking). */
  async upsertFileEntry(
    dirPath: string,
    fileName: string,
    entry: FileMetadataEntry,
  ): Promise<void> {
    await this.withLock(dirPath, async () => {
      const index = await this.readIndex(dirPath);
      index.files[fileName] = entry;
      await this.writeIndex(dirPath, index);
    });
  }

  /** Remove metadata for a file. */
  async removeFileEntry(dirPath: string, fileName: string): Promise<void> {
    await this.withLock(dirPath, async () => {
      const index = await this.readIndex(dirPath);
      delete index.files[fileName];
      await this.writeIndex(dirPath, index);
    });
  }

  /** Get metadata for a single file. Returns null if not found. */
  async getFileEntry(dirPath: string, fileName: string): Promise<FileMetadataEntry | null> {
    const index = await this.readIndex(dirPath);
    return index.files[fileName] ?? null;
  }

  /** Rename metadata entry (remove old key, add new key). */
  async renameFileEntry(dirPath: string, oldName: string, newName: string): Promise<void> {
    await this.withLock(dirPath, async () => {
      const index = await this.readIndex(dirPath);
      const entry = index.files[oldName];
      if (entry) {
        index.files[newName] = entry;
        delete index.files[oldName];
        await this.writeIndex(dirPath, index);
      }
    });
  }

  /** Move metadata from one directory index to another. */
  async moveFileEntry(
    sourceDirPath: string,
    targetDirPath: string,
    fileName: string,
    newFileName?: string,
  ): Promise<void> {
    let entry: FileMetadataEntry | undefined;

    await this.withLock(sourceDirPath, async () => {
      const idx = await this.readIndex(sourceDirPath);
      entry = idx.files[fileName];
      if (!entry) return;
      delete idx.files[fileName];
      await this.writeIndex(sourceDirPath, idx);
    });

    if (!entry) return;

    await this.withLock(targetDirPath, async () => {
      const idx = await this.readIndex(targetDirPath);
      idx.files[newFileName ?? fileName] = entry!;
      await this.writeIndex(targetDirPath, idx);
    });
  }

  /** Execute a function with a per-directory lock */
  private async withLock(dirPath: string, fn: () => Promise<void>): Promise<void> {
    const normalizedPath = path.resolve(dirPath);
    const existing = this.locks.get(normalizedPath) ?? Promise.resolve();

    const newLock = existing.then(fn, fn);
    this.locks.set(normalizedPath, newLock);

    try {
      await newLock;
    } finally {
      if (this.locks.get(normalizedPath) === newLock) {
        this.locks.delete(normalizedPath);
      }
    }
  }
}
