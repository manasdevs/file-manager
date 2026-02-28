import type { ValidatedConfig } from "../types/config.js";
import type { MetadataManager } from "./metadata-manager.js";
import type { PathResolver } from "./path-resolver.js";
import type { Logger } from "./logger.js";
import type { StorageAdapter } from "../adapters/storage-adapter.js";

interface CleanupResult {
  filesDeleted: number;
  errors: number;
}

export class CleanupManager {
  private running = false;
  private readonly cleanupMetaKey: string;

  constructor(
    private readonly config: ValidatedConfig,
    private readonly metadataManager: MetadataManager,
    private readonly pathResolver: PathResolver,
    private readonly logger: Logger,
    private readonly storage: StorageAdapter,
  ) {
    this.cleanupMetaKey = this.pathResolver.join(config.basePath, ".manasfm.cleanup.json");
  }

  /**
   * Called at the start of every API operation.
   * Checks if cleanup is due. If so, runs it asynchronously (non-blocking).
   */
  async maybeRunCleanup(): Promise<void> {
    if (!this.config.cleanup.enabled || this.running) return;

    const lastCleanup = await this.getLastCleanupTime();
    const intervalMs = this.config.cleanup.intervalHours * 3600000;

    if (lastCleanup && Date.now() - lastCleanup.getTime() < intervalMs) {
      return;
    }

    // Fire and forget - don't block the calling operation
    this.runCleanup().catch((error) => {
      this.logger.error("Cleanup failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  /** Force a cleanup run regardless of interval. */
  async runCleanup(): Promise<CleanupResult> {
    if (this.running) {
      return { filesDeleted: 0, errors: 0 };
    }

    this.running = true;
    this.logger.info("Starting cleanup run");

    let filesDeleted = 0;
    let errors = 0;

    try {
      const now = Date.now();

      for (const [slug, slugConfig] of Object.entries(this.config.slugs)) {
        if (slugConfig.retentionDays === null) continue;

        try {
          const result = await this.cleanupDirectory(slugConfig.path, slug, now);
          filesDeleted += result.filesDeleted;
          errors += result.errors;
        } catch (error) {
          errors++;
          this.logger.error("Cleanup error for slug", {
            slug,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      await this.setLastCleanupTime(new Date());

      this.logger.info("Cleanup completed", { filesDeleted, errors });
    } finally {
      this.running = false;
    }

    return { filesDeleted, errors };
  }

  private async cleanupDirectory(
    dirPath: string,
    slug: string,
    now: number,
  ): Promise<CleanupResult> {
    let filesDeleted = 0;
    let errors = 0;

    const index = await this.metadataManager.readIndex(dirPath);

    for (const [fileName, entry] of Object.entries(index.files)) {
      if (!entry.retentionExpiresAt) continue;

      const expiresAt = new Date(entry.retentionExpiresAt).getTime();
      if (now < expiresAt) continue;

      try {
        const fileKey = this.pathResolver.join(dirPath, fileName);

        // Delete main file
        await this.storage.deleteFile(fileKey);

        // Delete versions
        for (const version of entry.versions) {
          const versionPath = this.pathResolver.getVersionPath(
            fileKey,
            parseInt(version.versionId.replace("v", ""), 10),
          );
          await this.storage.deleteFile(versionPath);
        }

        // Delete variants
        if (entry.variants.compressed) {
          const compressedKey = this.pathResolver.join(dirPath, entry.variants.compressed);
          await this.storage.deleteFile(compressedKey);
        }
        if (entry.variants.zip) {
          const zipKey = this.pathResolver.join(dirPath, entry.variants.zip);
          await this.storage.deleteFile(zipKey);
        }

        // Remove metadata
        await this.metadataManager.removeFileEntry(dirPath, fileName);

        filesDeleted++;
        this.logger.info("Expired file deleted", { slug, fileName });
      } catch (error) {
        errors++;
        this.logger.error("Failed to delete expired file", {
          slug,
          fileName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Recurse into subdirectories
    try {
      const dirs = await this.storage.listDirectories(dirPath);
      for (const dir of dirs) {
        const subResult = await this.cleanupDirectory(dir.key, slug, now);
        filesDeleted += subResult.filesDeleted;
        errors += subResult.errors;
      }
    } catch {
      // Directory may not exist yet
    }

    return { filesDeleted, errors };
  }

  private async getLastCleanupTime(): Promise<Date | null> {
    try {
      const buffer = await this.storage.readFile(this.cleanupMetaKey);
      const data = JSON.parse(buffer.toString("utf-8")) as { lastCleanupTime: string };
      return new Date(data.lastCleanupTime);
    } catch {
      return null;
    }
  }

  private async setLastCleanupTime(time: Date): Promise<void> {
    try {
      await this.storage.writeFile(
        this.cleanupMetaKey,
        JSON.stringify({ lastCleanupTime: time.toISOString() }),
      );
    } catch (error) {
      this.logger.error("Failed to write cleanup timestamp", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
