import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ValidatedConfig } from "../types/config.js";
import type { MetadataManager } from "./metadata-manager.js";
import type { PathResolver } from "./path-resolver.js";
import type { Logger } from "./logger.js";
import { safeDeleteFile } from "./fs-utils.js";

interface CleanupResult {
  filesDeleted: number;
  errors: number;
}

export class CleanupManager {
  private running = false;
  private readonly cleanupMetaPath: string;

  constructor(
    private readonly config: ValidatedConfig,
    private readonly metadataManager: MetadataManager,
    private readonly pathResolver: PathResolver,
    private readonly logger: Logger,
  ) {
    this.cleanupMetaPath = path.join(config.basePath, ".manasfm.cleanup.json");
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
        const filePath = path.join(dirPath, fileName);

        // Delete main file
        await safeDeleteFile(filePath);

        // Delete versions
        for (const version of entry.versions) {
          const versionPath = this.pathResolver.getVersionPath(
            filePath,
            parseInt(version.versionId.replace("v", ""), 10),
          );
          await safeDeleteFile(versionPath);
        }

        // Delete variants
        if (entry.variants.compressed) {
          await safeDeleteFile(path.resolve(dirPath, entry.variants.compressed));
        }
        if (entry.variants.zip) {
          await safeDeleteFile(path.resolve(dirPath, entry.variants.zip));
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
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subResult = await this.cleanupDirectory(path.join(dirPath, entry.name), slug, now);
          filesDeleted += subResult.filesDeleted;
          errors += subResult.errors;
        }
      }
    } catch {
      // Directory may not exist yet
    }

    return { filesDeleted, errors };
  }

  private async getLastCleanupTime(): Promise<Date | null> {
    try {
      const content = await fs.readFile(this.cleanupMetaPath, "utf-8");
      const data = JSON.parse(content) as { lastCleanupTime: string };
      return new Date(data.lastCleanupTime);
    } catch {
      return null;
    }
  }

  private async setLastCleanupTime(time: Date): Promise<void> {
    try {
      await fs.writeFile(
        this.cleanupMetaPath,
        JSON.stringify({ lastCleanupTime: time.toISOString() }),
      );
    } catch (error) {
      this.logger.error("Failed to write cleanup timestamp", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
