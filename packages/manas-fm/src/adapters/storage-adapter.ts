import type { Writable } from "node:stream";

/** Stats for a stored file or object */
export interface StorageFileStats {
  size: number;
  lastModified: Date;
}

/** A single item returned by listFiles */
export interface StorageListItem {
  name: string;
  key: string;
  size: number;
  lastModified: Date;
}

/** A single directory/prefix entry returned by listDirectories */
export interface StorageDirectoryItem {
  name: string;
  key: string;
}

/**
 * Abstract storage adapter interface.
 *
 * All paths ("keys") are forward-slash-delimited strings relative to
 * the storage root. For local storage the root is `basePath`; for
 * cloud storage it is the bucket + optional key prefix.
 */
export interface StorageAdapter {
  /** Unique identifier for this adapter type */
  readonly type: string;

  // ─── File Operations ───────────────────────────────────────────

  /** Write data to a key. Creates intermediate "directories" as needed. */
  writeFile(key: string, data: Buffer | string): Promise<void>;

  /** Read a file's entire contents into a Buffer. */
  readFile(key: string): Promise<Buffer>;

  /** Delete a file. Returns true if the file was deleted, false if not found. */
  deleteFile(key: string): Promise<boolean>;

  /** Copy a file from one key to another. */
  copyFile(sourceKey: string, destinationKey: string): Promise<void>;

  /**
   * Move a file from one key to another.
   * Default cloud implementation: copy + delete.
   */
  moveFile(sourceKey: string, destinationKey: string): Promise<void>;

  /** Check whether a file exists at the given key. */
  fileExists(key: string): Promise<boolean>;

  /** Get stats (size, lastModified) for a file. Returns null if not found. */
  getFileStats(key: string): Promise<StorageFileStats | null>;

  // ─── Directory / Listing ───────────────────────────────────────

  /**
   * List files (non-directory entries) directly under `prefix`.
   * For local storage this lists files in a directory.
   * For cloud storage this lists objects with the given key prefix
   * (one level deep, not recursive).
   */
  listFiles(prefix: string): Promise<StorageListItem[]>;

  /**
   * List "directories" (common prefixes) directly under `prefix`.
   * For local storage this lists subdirectories.
   * For cloud storage this uses the delimiter `/` to list
   * common prefixes one level deep.
   */
  listDirectories(prefix: string): Promise<StorageDirectoryItem[]>;

  /**
   * Ensure the directory/prefix exists.
   * For local storage this creates the directory recursively.
   * Cloud implementations may no-op (directories are virtual).
   */
  ensureDirectory(prefix: string): Promise<void>;

  // ─── Streaming ─────────────────────────────────────────────────

  /**
   * Create a writable stream targeting the given key.
   * Used by the zip (archiver) pipeline.
   *
   * The returned writable should emit `close` when the upload is
   * complete so callers can await the archive finalization.
   */
  createWriteStream(key: string): Promise<Writable>;

  // ─── URLs ──────────────────────────────────────────────────────

  /**
   * Return a URL or path for the given key.
   *
   * - Local: returns the absolute file system path
   * - Cloud: returns an HTTPS URL (possibly signed / pre-signed)
   */
  getFileUrl(key: string): string;
}
