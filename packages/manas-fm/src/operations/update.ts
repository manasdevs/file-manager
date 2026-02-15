import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { OperationContext, FileMetadataEntry } from "../types/internal.js";
import type { FileIdentifier, FileInput, UpdateOptions } from "../types/common.js";
import type { UploadResult } from "../types/results.js";
import { FileNotFoundError } from "../errors/file-not-found-error.js";
import { ValidationError } from "../errors/validation-error.js";
import { atomicWriteFile, fileExists, copyFile, safeDeleteFile } from "../core/fs-utils.js";
import { runCompression } from "./compression.js";
import { runZip } from "./zip.js";

export function createUpdateFile(ctx: OperationContext) {
  return async function updateFile(
    identifier: FileIdentifier,
    newFile: FileInput,
    options?: UpdateOptions,
  ): Promise<UploadResult> {
    await ctx.cleanupManager.maybeRunCleanup();

    const resolved = ctx.pathResolver.resolveFilePath(identifier);

    if (!(await fileExists(resolved.absolutePath))) {
      throw new FileNotFoundError(`File not found: ${resolved.fileName}`, {
        path: resolved.absolutePath,
      });
    }

    const slugConfig = resolved.slug ? ctx.pathResolver.getSlugConfig(resolved.slug) : null;

    // Validate file type if slug config exists
    if (slugConfig && slugConfig.allowedTypes.length > 0) {
      if (!slugConfig.allowedTypes.includes(newFile.mimeType)) {
        throw new ValidationError(
          `File type "${newFile.mimeType}" is not allowed for slug "${resolved.slug}"`,
          { allowed: slugConfig.allowedTypes },
        );
      }
    }

    // Validate file size
    if (slugConfig && newFile.size > slugConfig.maxSizeBytes) {
      throw new ValidationError(
        `File size ${newFile.size} bytes exceeds maximum ${slugConfig.maxSizeBytes} bytes`,
      );
    }

    // Get existing metadata
    const existingMetadata = await ctx.metadataManager.getFileEntry(
      resolved.directory,
      resolved.fileName,
    );

    // Handle versioning
    const shouldVersion =
      options?.createVersion !== undefined
        ? options.createVersion
        : (slugConfig?.versioning.enabled ?? false);

    const versions = existingMetadata?.versions ? [...existingMetadata.versions] : [];

    if (shouldVersion) {
      const currentStat = await fs.stat(resolved.absolutePath);
      // Use highest existing version number to avoid collisions after maxVersions pruning
      const maxExisting = versions.reduce((max, v) => {
        const num = parseInt(v.versionId.replace("v", ""), 10);
        return num > max ? num : max;
      }, 0);
      const versionNumber = maxExisting + 1;
      const versionPath = ctx.pathResolver.getVersionPath(resolved.absolutePath, versionNumber);

      // Copy current file to version path
      await copyFile(resolved.absolutePath, versionPath);

      versions.push({
        versionId: `v${versionNumber}`,
        createdAt: new Date().toISOString(),
        size: currentStat.size,
      });

      // Enforce maxVersions
      const maxVersions = slugConfig?.versioning.maxVersions ?? 10;
      while (versions.length > maxVersions) {
        const oldest = versions.shift()!;
        const oldVersionNum = parseInt(oldest.versionId.replace("v", ""), 10);
        const oldVersionPath = ctx.pathResolver.getVersionPath(
          resolved.absolutePath,
          oldVersionNum,
        );
        await safeDeleteFile(oldVersionPath);
        ctx.logger.info("Old version removed", {
          fileName: resolved.fileName,
          version: oldest.versionId,
        });
      }
    }

    // Write new file
    await atomicWriteFile(resolved.absolutePath, newFile.buffer);

    const now = new Date().toISOString();
    const variants: { compressed?: string; zip?: string } = {};

    // Re-run zip BEFORE compression (compression may delete the original if keepOriginal=false)
    if (slugConfig?.zip) {
      try {
        const zipPath = await runZip(resolved.absolutePath, slugConfig.zip, ctx);
        variants.zip = path.relative(resolved.directory, zipPath);
      } catch (error) {
        ctx.logger.error("Zip failed on update", {
          fileName: resolved.fileName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Re-run compression after zip
    if (slugConfig?.compression) {
      try {
        const compressedPath = await runCompression(
          resolved.absolutePath,
          newFile.buffer,
          slugConfig.compression,
          ctx,
        );
        variants.compressed = path.relative(resolved.directory, compressedPath);
      } catch (error) {
        ctx.logger.error("Compression failed on update", {
          fileName: resolved.fileName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Update metadata
    const updatedMetadata: FileMetadataEntry = {
      originalName: existingMetadata?.originalName ?? newFile.originalName,
      mimeType: newFile.mimeType,
      size: newFile.size,
      createdAt: existingMetadata?.createdAt ?? now,
      updatedAt: now,
      slug: resolved.slug ?? existingMetadata?.slug ?? "",
      versions,
      variants,
      retentionExpiresAt: slugConfig?.retentionDays
        ? new Date(Date.now() + slugConfig.retentionDays * 86400000).toISOString()
        : (existingMetadata?.retentionExpiresAt ?? null),
    };

    await ctx.metadataManager.upsertFileEntry(
      resolved.directory,
      resolved.fileName,
      updatedMetadata,
    );

    ctx.logger.info("File updated", { fileName: resolved.fileName, versioned: shouldVersion });

    return {
      success: true,
      filePath: resolved.absolutePath,
      fileName: resolved.fileName,
      slug: resolved.slug ?? "",
      size: newFile.size,
      mimeType: newFile.mimeType,
      createdAt: updatedMetadata.createdAt,
      variants: Object.keys(variants).length > 0 ? variants : undefined,
    };
  };
}
