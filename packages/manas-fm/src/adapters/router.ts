import type { Writable } from "node:stream";
import type {
  StorageAdapter,
  StorageFileStats,
  StorageListItem,
  StorageDirectoryItem,
} from "./storage-adapter.js";
import type { PathResolver } from "../core/path-resolver.js";

/**
 * A routing storage adapter that transparently forwards every file operation to
 * the appropriate per-slug adapter, falling back to the global adapter for paths
 * that do not belong to any slug (e.g. the cleanup-timestamp file).
 *
 * For two-key operations (copyFile / moveFile) the adapter also handles
 * cross-storage scenarios where source and destination live in different backends.
 */
export class RouterStorageAdapter implements StorageAdapter {
  readonly type = "router";

  constructor(
    /** The global / fallback adapter (used when no slug-specific adapter matches) */
    private readonly globalAdapter: StorageAdapter,
    /**
     * Per-slug overrides: a map of slug name → StorageAdapter.
     * Only slugs that declare their own `storage` config appear here.
     */
    private readonly slugAdapters: ReadonlyMap<string, StorageAdapter>,
    /** Used to resolve which slug a given path/key belongs to */
    private readonly pathResolver: PathResolver,
  ) {}

  // ─── Routing helper ─────────────────────────────────────────

  private adapterFor(key: string): StorageAdapter {
    if (this.slugAdapters.size === 0) return this.globalAdapter;
    const slug = this.pathResolver.resolveSlugFromPath(key);
    if (slug) {
      return this.slugAdapters.get(slug) ?? this.globalAdapter;
    }
    return this.globalAdapter;
  }

  // ─── Single-key operations ───────────────────────────────────

  writeFile(key: string, data: Buffer | string): Promise<void> {
    return this.adapterFor(key).writeFile(key, data);
  }

  readFile(key: string): Promise<Buffer> {
    return this.adapterFor(key).readFile(key);
  }

  deleteFile(key: string): Promise<boolean> {
    return this.adapterFor(key).deleteFile(key);
  }

  fileExists(key: string): Promise<boolean> {
    return this.adapterFor(key).fileExists(key);
  }

  getFileStats(key: string): Promise<StorageFileStats | null> {
    return this.adapterFor(key).getFileStats(key);
  }

  listFiles(prefix: string): Promise<StorageListItem[]> {
    return this.adapterFor(prefix).listFiles(prefix);
  }

  listDirectories(prefix: string): Promise<StorageDirectoryItem[]> {
    return this.adapterFor(prefix).listDirectories(prefix);
  }

  ensureDirectory(prefix: string): Promise<void> {
    return this.adapterFor(prefix).ensureDirectory(prefix);
  }

  createWriteStream(key: string): Promise<Writable> {
    return this.adapterFor(key).createWriteStream(key);
  }

  getFileUrl(key: string): string {
    return this.adapterFor(key).getFileUrl(key);
  }

  // ─── Two-key operations (cross-storage aware) ────────────────

  async copyFile(sourceKey: string, destinationKey: string): Promise<void> {
    const srcAdapter = this.adapterFor(sourceKey);
    const dstAdapter = this.adapterFor(destinationKey);

    if (srcAdapter === dstAdapter) {
      return srcAdapter.copyFile(sourceKey, destinationKey);
    }

    // Cross-storage copy: stream data from source and write to destination
    const data = await srcAdapter.readFile(sourceKey);
    await dstAdapter.writeFile(destinationKey, data);
  }

  async moveFile(sourceKey: string, destinationKey: string): Promise<void> {
    const srcAdapter = this.adapterFor(sourceKey);
    const dstAdapter = this.adapterFor(destinationKey);

    if (srcAdapter === dstAdapter) {
      return srcAdapter.moveFile(sourceKey, destinationKey);
    }

    // Cross-storage move: copy to destination, then delete from source
    const data = await srcAdapter.readFile(sourceKey);
    await dstAdapter.writeFile(destinationKey, data);
    await srcAdapter.deleteFile(sourceKey);
  }
}
