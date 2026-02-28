import { PassThrough } from "node:stream";
import type { Writable } from "node:stream";
import type {
  StorageAdapter,
  StorageFileStats,
  StorageListItem,
  StorageDirectoryItem,
} from "./storage-adapter.js";
import type { AzureStorageConfig } from "../types/config.js";
import { ConfigError } from "../errors/config-error.js";

/**
 * Azure Blob Storage adapter.
 *
 * Uses dynamic import of `@azure/storage-blob` so the SDK is an
 * optional peer dependency.
 */
export class AzureBlobStorageAdapter implements StorageAdapter {
  readonly type = "azure";

  private readonly containerName: string;
  private readonly prefix: string;
  private readonly connectionString?: string;
  private readonly accountName?: string;
  private readonly accountKey?: string;

  // Lazy-loaded SDK
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _containerClient: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _azModule: any = null;

  constructor(config: AzureStorageConfig) {
    this.containerName = config.container;
    this.prefix = (config.prefix ?? "").replace(/\/+$/, "");
    this.connectionString = config.connectionString;
    this.accountName = config.accountName;
    this.accountKey = config.accountKey;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getContainer(): Promise<any> {
    if (this._containerClient) return this._containerClient;

    try {
      this._azModule = await import("@azure/storage-blob");
    } catch {
      throw new ConfigError(
        "Azure Blob Storage requires '@azure/storage-blob' to be installed. " +
          "Install it with: npm install @azure/storage-blob",
      );
    }

    const { BlobServiceClient, StorageSharedKeyCredential } = this._azModule;
    let serviceClient;
    if (this.connectionString) {
      serviceClient = BlobServiceClient.fromConnectionString(this.connectionString);
    } else if (this.accountName && this.accountKey) {
      const cred = new StorageSharedKeyCredential(this.accountName, this.accountKey);
      serviceClient = new BlobServiceClient(
        `https://${this.accountName}.blob.core.windows.net`,
        cred,
      );
    } else {
      throw new ConfigError(
        "Azure storage requires either 'connectionString' or 'accountName' + 'accountKey'.",
      );
    }
    this._containerClient = serviceClient.getContainerClient(this.containerName);
    return this._containerClient;
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
    const container = await this.getContainer();
    const blob = container.getBlockBlobClient(this.fullKey(key));
    const body = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
    await blob.upload(body, body.length);
  }

  async readFile(key: string): Promise<Buffer> {
    const container = await this.getContainer();
    const blob = container.getBlockBlobClient(this.fullKey(key));
    const downloadResponse = await blob.download(0);
    const stream = downloadResponse.readableStreamBody;
    if (!stream) throw new Error(`Empty response body for key: ${key}`);

    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async deleteFile(key: string): Promise<boolean> {
    const container = await this.getContainer();
    const blob = container.getBlockBlobClient(this.fullKey(key));
    try {
      await blob.delete();
      return true;
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404) return false;
      throw error;
    }
  }

  async copyFile(sourceKey: string, destinationKey: string): Promise<void> {
    const container = await this.getContainer();
    const sourceBlob = container.getBlockBlobClient(this.fullKey(sourceKey));
    const destBlob = container.getBlockBlobClient(this.fullKey(destinationKey));
    const poller = await destBlob.beginCopyFromURL(sourceBlob.url);
    await poller.pollUntilDone();
  }

  async moveFile(sourceKey: string, destinationKey: string): Promise<void> {
    await this.copyFile(sourceKey, destinationKey);
    await this.deleteFile(sourceKey);
  }

  async fileExists(key: string): Promise<boolean> {
    const container = await this.getContainer();
    const blob = container.getBlockBlobClient(this.fullKey(key));
    return blob.exists();
  }

  async getFileStats(key: string): Promise<StorageFileStats | null> {
    const container = await this.getContainer();
    const blob = container.getBlockBlobClient(this.fullKey(key));
    try {
      const props = await blob.getProperties();
      return {
        size: props.contentLength ?? 0,
        lastModified: props.lastModified ?? new Date(),
      };
    } catch {
      return null;
    }
  }

  // ─── Directory / Listing ─────────────────────────────────────

  async listFiles(prefix: string): Promise<StorageListItem[]> {
    const container = await this.getContainer();
    const fullPrefix = this.fullKey(prefix).replace(/\/?$/, "/");

    const items: StorageListItem[] = [];
    // Use byPage iterator with delimiter for hierarchical listing
    const iter = container.listBlobsByHierarchy("/", { prefix: fullPrefix });

    for await (const item of iter) {
      if (item.kind === "prefix") continue; // skip virtual directories
      const name = item.name.slice(fullPrefix.length);
      if (!name || name.includes("/")) continue;
      items.push({
        name,
        key: this.stripPrefix(item.name),
        size: item.properties?.contentLength ?? 0,
        lastModified: item.properties?.lastModified ?? new Date(),
      });
    }

    return items;
  }

  async listDirectories(prefix: string): Promise<StorageDirectoryItem[]> {
    const container = await this.getContainer();
    const fullPrefix = this.fullKey(prefix).replace(/\/?$/, "/");

    const dirs: StorageDirectoryItem[] = [];
    const iter = container.listBlobsByHierarchy("/", { prefix: fullPrefix });

    for await (const item of iter) {
      if (item.kind !== "prefix") continue;
      const name = item.name.slice(fullPrefix.length).replace(/\/+$/, "");
      if (!name) continue;
      dirs.push({
        name,
        key: this.stripPrefix(item.name.replace(/\/+$/, "")),
      });
    }

    return dirs;
  }

  async ensureDirectory(_prefix: string): Promise<void> {
    // Directories are virtual in Azure Blob Storage
  }

  // ─── Streaming ────────────────────────────────────────────────

  async createWriteStream(key: string): Promise<Writable> {
    const container = await this.getContainer();
    const blob = container.getBlockBlobClient(this.fullKey(key));

    const passThrough = new PassThrough();

    // Upload from stream; when done emit 'close'
    blob.uploadStream(passThrough).then(
      () => passThrough.emit("close"),
      (err: Error) => passThrough.destroy(err),
    );

    return passThrough;
  }

  // ─── URLs ─────────────────────────────────────────────────────

  getFileUrl(key: string): string {
    const fk = this.fullKey(key);
    if (this.accountName) {
      return `https://${this.accountName}.blob.core.windows.net/${this.containerName}/${fk}`;
    }
    // Fallback – try to extract account name from connection string
    const match = this.connectionString?.match(/AccountName=([^;]+)/i);
    const acct = match?.[1] ?? "<account>";
    return `https://${acct}.blob.core.windows.net/${this.containerName}/${fk}`;
  }
}
