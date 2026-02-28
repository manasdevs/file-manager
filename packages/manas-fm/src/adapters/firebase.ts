import { PassThrough } from "node:stream";
import type { Writable } from "node:stream";
import type {
  StorageAdapter,
  StorageFileStats,
  StorageListItem,
  StorageDirectoryItem,
} from "./storage-adapter.js";
import type { FirebaseStorageConfig } from "../types/config.js";
import { ConfigError } from "../errors/config-error.js";

/**
 * Firebase Storage adapter.
 *
 * Uses dynamic import of `firebase-admin/storage` so the SDK is an
 * optional peer dependency. The user must initialize `firebase-admin`
 * before creating the file manager.
 */
export class FirebaseStorageAdapter implements StorageAdapter {
  readonly type = "firebase";

  private readonly bucketName: string;
  private readonly prefix: string;

  // Lazy-loaded bucket reference
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _bucket: any = null;

  constructor(config: FirebaseStorageConfig) {
    this.bucketName = config.bucket;
    this.prefix = (config.prefix ?? "").replace(/\/+$/, "");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getBucket(): Promise<any> {
    if (this._bucket) return this._bucket;

    try {
      const firebaseStorage = await import("firebase-admin/storage");
      const storage = firebaseStorage.getStorage();
      this._bucket = storage.bucket(this.bucketName);
    } catch {
      throw new ConfigError(
        "Firebase Storage requires 'firebase-admin' to be installed and initialized. " +
          "Install it with: npm install firebase-admin",
      );
    }

    return this._bucket;
  }

  private fullKey(key: string): string {
    const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
    return this.prefix ? `${this.prefix}/${normalized}` : normalized;
  }

  private stripPrefix(fullKey: string): string {
    if (this.prefix && fullKey.startsWith(this.prefix + "/")) {
      return fullKey.slice(this.prefix.length + 1);
    }
    return fullKey;
  }

  // ─── File Operations ─────────────────────────────────────────

  async writeFile(key: string, data: Buffer | string): Promise<void> {
    const bucket = await this.getBucket();
    const file = bucket.file(this.fullKey(key));
    const body = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
    await file.save(body);
  }

  async readFile(key: string): Promise<Buffer> {
    const bucket = await this.getBucket();
    const file = bucket.file(this.fullKey(key));
    const [contents] = await file.download();
    return contents;
  }

  async deleteFile(key: string): Promise<boolean> {
    const bucket = await this.getBucket();
    const file = bucket.file(this.fullKey(key));
    try {
      const [exists] = await file.exists();
      if (!exists) return false;
      await file.delete();
      return true;
    } catch {
      return false;
    }
  }

  async copyFile(sourceKey: string, destinationKey: string): Promise<void> {
    const bucket = await this.getBucket();
    const srcFile = bucket.file(this.fullKey(sourceKey));
    await srcFile.copy(bucket.file(this.fullKey(destinationKey)));
  }

  async moveFile(sourceKey: string, destinationKey: string): Promise<void> {
    const bucket = await this.getBucket();
    const srcFile = bucket.file(this.fullKey(sourceKey));
    await srcFile.move(bucket.file(this.fullKey(destinationKey)));
  }

  async fileExists(key: string): Promise<boolean> {
    const bucket = await this.getBucket();
    const file = bucket.file(this.fullKey(key));
    const [exists] = await file.exists();
    return exists;
  }

  async getFileStats(key: string): Promise<StorageFileStats | null> {
    const bucket = await this.getBucket();
    const file = bucket.file(this.fullKey(key));
    try {
      const [metadata] = await file.getMetadata();
      return {
        size: parseInt(metadata.size ?? "0", 10),
        lastModified: new Date(metadata.updated ?? metadata.timeCreated ?? Date.now()),
      };
    } catch {
      return null;
    }
  }

  // ─── Directory / Listing ─────────────────────────────────────

  async listFiles(prefix: string): Promise<StorageListItem[]> {
    const bucket = await this.getBucket();
    const fullPrefix = this.fullKey(prefix).replace(/\/?$/, "/");

    const [files] = await bucket.getFiles({
      prefix: fullPrefix,
      delimiter: "/",
    });

    const items: StorageListItem[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const file of files as any[]) {
      const name = file.name.slice(fullPrefix.length);
      if (!name || name.includes("/")) continue;
      items.push({
        name,
        key: this.stripPrefix(file.name),
        size: parseInt(file.metadata?.size ?? "0", 10),
        lastModified: new Date(file.metadata?.updated ?? file.metadata?.timeCreated ?? Date.now()),
      });
    }

    return items;
  }

  async listDirectories(prefix: string): Promise<StorageDirectoryItem[]> {
    const bucket = await this.getBucket();
    const fullPrefix = this.fullKey(prefix).replace(/\/?$/, "/");

    const [, , apiResponse] = await bucket.getFiles({
      prefix: fullPrefix,
      delimiter: "/",
      autoPaginate: false,
    });

    const dirs: StorageDirectoryItem[] = [];
    const prefixes = (apiResponse as { prefixes?: string[] }).prefixes ?? [];
    for (const p of prefixes) {
      const name = p.slice(fullPrefix.length).replace(/\/+$/, "");
      if (!name) continue;
      dirs.push({
        name,
        key: this.stripPrefix(p.replace(/\/+$/, "")),
      });
    }

    return dirs;
  }

  async ensureDirectory(_prefix: string): Promise<void> {
    // Directories are virtual in Firebase/GCS
  }

  // ─── Streaming ────────────────────────────────────────────────

  async createWriteStream(key: string): Promise<Writable> {
    const bucket = await this.getBucket();
    const file = bucket.file(this.fullKey(key));

    const passThrough = new PassThrough();
    const writeStream = file.createWriteStream({ resumable: false });

    // Pipe passthrough to the Firebase upload stream
    passThrough.pipe(writeStream);

    writeStream.on("finish", () => passThrough.emit("close"));
    writeStream.on("error", (err: Error) => passThrough.destroy(err));

    return passThrough;
  }

  // ─── URLs ─────────────────────────────────────────────────────

  getFileUrl(key: string): string {
    const fk = this.fullKey(key);
    const encodedPath = encodeURIComponent(fk);
    return `https://firebasestorage.googleapis.com/v0/b/${this.bucketName}/o/${encodedPath}?alt=media`;
  }
}
