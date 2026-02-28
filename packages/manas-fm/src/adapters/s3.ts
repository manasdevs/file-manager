import { PassThrough } from "node:stream";
import type { Writable } from "node:stream";
import type {
  StorageAdapter,
  StorageFileStats,
  StorageListItem,
  StorageDirectoryItem,
} from "./storage-adapter.js";
import { S3_PRESETS, resolveEndpoint } from "./s3-presets.js";
import type { S3StorageConfig } from "../types/config.js";
import type { Upload as UploadClass } from "@aws-sdk/lib-storage";
import { ConfigError } from "../errors/config-error.js";

/**
 * S3-compatible storage adapter.
 *
 * Works with AWS S3, Google Cloud Storage, DigitalOcean Spaces,
 * Backblaze B2, Wasabi, MinIO, Oracle, IBM, Supabase Storage,
 * Cloudflare R2, and any other S3-compatible endpoint.
 *
 * Uses dynamic imports so `@aws-sdk/client-s3` and `@aws-sdk/lib-storage`
 * are only loaded when this adapter is actually used.
 */
export class S3StorageAdapter implements StorageAdapter {
  readonly type = "s3";

  private readonly bucket: string;
  private readonly prefix: string;
  private readonly region: string;
  private readonly endpoint: string;
  private readonly forcePathStyle: boolean;
  private readonly credentials: { accessKeyId: string; secretAccessKey: string };

  // Lazy-loaded AWS SDK instances
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _client: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _s3Module: any = null;

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket;
    this.prefix = (config.prefix ?? "").replace(/\/+$/, "");
    this.region = config.region ?? "us-east-1";
    this.credentials = {
      accessKeyId: config.credentials?.accessKeyId ?? "",
      secretAccessKey: config.credentials?.secretAccessKey ?? "",
    };

    // Resolve endpoint from preset or custom
    if (config.endpoint) {
      this.endpoint = config.endpoint;
      this.forcePathStyle = config.forcePathStyle ?? false;
    } else {
      const providerId = config.s3Provider ?? "aws";
      const preset = S3_PRESETS[providerId];
      if (!preset) {
        throw new ConfigError(`Unknown S3 provider: ${providerId}`);
      }
      this.endpoint = resolveEndpoint(preset.endpoint, this.region);
      this.forcePathStyle = preset.forcePathStyle;
    }
  }

  /** Get or create the S3Client (lazy loaded) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getClient(): Promise<any> {
    if (this._client) return this._client;

    try {
      this._s3Module = await import("@aws-sdk/client-s3");
    } catch {
      throw new ConfigError(
        "S3 storage requires '@aws-sdk/client-s3' to be installed. " +
          "Install it with: npm install @aws-sdk/client-s3 @aws-sdk/lib-storage",
      );
    }

    const { S3Client } = this._s3Module;
    this._client = new S3Client({
      region: this.region,
      endpoint: this.endpoint,
      forcePathStyle: this.forcePathStyle,
      credentials: this.credentials,
    });

    return this._client;
  }

  /** Prefix a key with the configured keyPrefix */
  private fullKey(key: string): string {
    const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
    return this.prefix ? `${this.prefix}/${normalized}` : normalized;
  }

  // ─── File Operations ─────────────────────────────────────────

  async writeFile(key: string, data: Buffer | string): Promise<void> {
    const client = await this.getClient();
    const { PutObjectCommand } = this._s3Module;

    const body = typeof data === "string" ? Buffer.from(data, "utf-8") : data;

    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.fullKey(key),
        Body: body,
      }),
    );
  }

  async readFile(key: string): Promise<Buffer> {
    const client = await this.getClient();
    const { GetObjectCommand } = this._s3Module;

    const response = await client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.fullKey(key),
      }),
    );

    // response.Body is a Readable stream
    const stream = response.Body;
    if (!stream) throw new Error(`Empty response body for key: ${key}`);

    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async deleteFile(key: string): Promise<boolean> {
    const client = await this.getClient();
    const { DeleteObjectCommand, HeadObjectCommand } = this._s3Module;

    // Check existence first (S3 DeleteObject doesn't error on missing keys)
    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: this.fullKey(key),
        }),
      );
    } catch {
      return false;
    }

    await client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.fullKey(key),
      }),
    );
    return true;
  }

  async copyFile(sourceKey: string, destinationKey: string): Promise<void> {
    const client = await this.getClient();
    const { CopyObjectCommand } = this._s3Module;

    await client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${this.fullKey(sourceKey)}`,
        Key: this.fullKey(destinationKey),
      }),
    );
  }

  async moveFile(sourceKey: string, destinationKey: string): Promise<void> {
    await this.copyFile(sourceKey, destinationKey);
    await this.deleteFile(sourceKey);
  }

  async fileExists(key: string): Promise<boolean> {
    const client = await this.getClient();
    const { HeadObjectCommand } = this._s3Module;

    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: this.fullKey(key),
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async getFileStats(key: string): Promise<StorageFileStats | null> {
    const client = await this.getClient();
    const { HeadObjectCommand } = this._s3Module;

    try {
      const response = await client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: this.fullKey(key),
        }),
      );
      return {
        size: response.ContentLength ?? 0,
        lastModified: response.LastModified ?? new Date(),
      };
    } catch {
      return null;
    }
  }

  // ─── Directory / Listing ─────────────────────────────────────

  async listFiles(prefix: string): Promise<StorageListItem[]> {
    const client = await this.getClient();
    const { ListObjectsV2Command } = this._s3Module;

    const fullPrefix = this.fullKey(prefix).replace(/\/?$/, "/");

    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: fullPrefix,
        Delimiter: "/",
      }),
    );

    const items: StorageListItem[] = [];
    for (const obj of response.Contents ?? []) {
      if (!obj.Key || obj.Key === fullPrefix) continue;
      const name = obj.Key.slice(fullPrefix.length);
      if (!name || name.includes("/")) continue; // skip sub-prefixes
      items.push({
        name,
        key: this.stripPrefix(obj.Key),
        size: obj.Size ?? 0,
        lastModified: obj.LastModified ?? new Date(),
      });
    }

    return items;
  }

  async listDirectories(prefix: string): Promise<StorageDirectoryItem[]> {
    const client = await this.getClient();
    const { ListObjectsV2Command } = this._s3Module;

    const fullPrefix = this.fullKey(prefix).replace(/\/?$/, "/");

    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: fullPrefix,
        Delimiter: "/",
      }),
    );

    const dirs: StorageDirectoryItem[] = [];
    for (const cp of response.CommonPrefixes ?? []) {
      if (!cp.Prefix) continue;
      const name = cp.Prefix.slice(fullPrefix.length).replace(/\/+$/, "");
      if (!name) continue;
      dirs.push({
        name,
        key: this.stripPrefix(cp.Prefix.replace(/\/+$/, "")),
      });
    }

    return dirs;
  }

  async ensureDirectory(_prefix: string): Promise<void> {
    // Directories are virtual in S3 — nothing to create
  }

  // ─── Streaming ────────────────────────────────────────────────

  async createWriteStream(key: string): Promise<Writable> {
    const client = await this.getClient();
    let Upload: typeof UploadClass;

    try {
      const libStorage = await import("@aws-sdk/lib-storage");
      Upload = libStorage.Upload;
    } catch {
      throw new ConfigError(
        "Streaming uploads require '@aws-sdk/lib-storage'. " +
          "Install it with: npm install @aws-sdk/lib-storage",
      );
    }

    const passThrough = new PassThrough();

    const upload = new Upload({
      client,
      params: {
        Bucket: this.bucket,
        Key: this.fullKey(key),
        Body: passThrough,
      },
    });

    // When upload finishes, emit 'close' on the passthrough so archiver resolves
    upload.done().then(
      () => passThrough.emit("close"),
      (err: Error) => passThrough.destroy(err),
    );

    return passThrough;
  }

  // ─── URLs ─────────────────────────────────────────────────────

  getFileUrl(key: string): string {
    const fk = this.fullKey(key);
    if (this.forcePathStyle) {
      return `${this.endpoint}/${this.bucket}/${fk}`;
    }
    // Virtual-hosted style
    const url = new URL(this.endpoint);
    return `${url.protocol}//${this.bucket}.${url.host}/${fk}`;
  }

  // ─── Internal helpers ─────────────────────────────────────────

  /** Strip the configured prefix from a full S3 key to get the user-facing key */
  private stripPrefix(fullKey: string): string {
    if (this.prefix && fullKey.startsWith(this.prefix + "/")) {
      return fullKey.slice(this.prefix.length + 1);
    }
    return fullKey;
  }
}
