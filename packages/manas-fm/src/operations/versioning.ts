import * as fs from "node:fs/promises";
import type { OperationContext } from "../types/internal.js";
import type { FileIdentifier } from "../types/common.js";
import type { VersionInfo, OperationResult } from "../types/results.js";
import { FileNotFoundError } from "../errors/file-not-found-error.js";
import { ValidationError } from "../errors/validation-error.js";
import { fileExists, copyFile, safeDeleteFile } from "../core/fs-utils.js";

export function createListVersions(ctx: OperationContext) {
  return async function listVersions(identifier: FileIdentifier): Promise<VersionInfo[]> {
    await ctx.cleanupManager.maybeRunCleanup();

    const resolved = ctx.pathResolver.resolveFilePath(identifier);
    const metadata = await ctx.metadataManager.getFileEntry(resolved.directory, resolved.fileName);

    if (!metadata) {
      throw new FileNotFoundError(`No metadata found for file: ${resolved.fileName}`, {
        path: resolved.absolutePath,
      });
    }

    return metadata.versions.map((v) => ({
      versionId: v.versionId,
      path: ctx.pathResolver.getVersionPath(
        resolved.absolutePath,
        parseInt(v.versionId.replace("v", ""), 10),
      ),
      createdAt: v.createdAt,
      size: v.size,
    }));
  };
}

export function createRestoreVersion(ctx: OperationContext) {
  return async function restoreVersion(
    identifier: FileIdentifier,
    versionId: string,
  ): Promise<OperationResult> {
    await ctx.cleanupManager.maybeRunCleanup();

    const resolved = ctx.pathResolver.resolveFilePath(identifier);
    const metadata = await ctx.metadataManager.getFileEntry(resolved.directory, resolved.fileName);

    if (!metadata) {
      throw new FileNotFoundError(`No metadata found for file: ${resolved.fileName}`, {
        path: resolved.absolutePath,
      });
    }

    const versionEntry = metadata.versions.find((v) => v.versionId === versionId);
    if (!versionEntry) {
      throw new ValidationError(
        `Version "${versionId}" not found for file "${resolved.fileName}"`,
        {
          availableVersions: metadata.versions.map((v) => v.versionId),
        },
      );
    }

    const versionNum = parseInt(versionId.replace("v", ""), 10);
    const versionPath = ctx.pathResolver.getVersionPath(resolved.absolutePath, versionNum);

    if (!(await fileExists(versionPath))) {
      throw new FileNotFoundError(`Version file not found: ${versionPath}`, {
        path: versionPath,
      });
    }

    // If current file exists, create a new version of it before restoring
    const slugConfig = resolved.slug ? ctx.pathResolver.getSlugConfig(resolved.slug) : null;
    const shouldVersion = slugConfig?.versioning.enabled ?? false;

    if (shouldVersion && (await fileExists(resolved.absolutePath))) {
      const currentStat = await fs.stat(resolved.absolutePath);
      // Use highest existing version number to avoid collisions
      const maxExisting = metadata.versions.reduce((max, v) => {
        const num = parseInt(v.versionId.replace("v", ""), 10);
        return num > max ? num : max;
      }, 0);
      const newVersionNum = maxExisting + 1;
      const newVersionPath = ctx.pathResolver.getVersionPath(resolved.absolutePath, newVersionNum);

      await copyFile(resolved.absolutePath, newVersionPath);

      metadata.versions.push({
        versionId: `v${newVersionNum}`,
        createdAt: new Date().toISOString(),
        size: currentStat.size,
      });

      // Enforce maxVersions
      const maxVersions = slugConfig?.versioning.maxVersions ?? 10;
      while (metadata.versions.length > maxVersions) {
        const oldest = metadata.versions.shift()!;
        const oldNum = parseInt(oldest.versionId.replace("v", ""), 10);
        const oldPath = ctx.pathResolver.getVersionPath(resolved.absolutePath, oldNum);
        await safeDeleteFile(oldPath);
      }
    }

    // Restore the version: copy version file to current
    await copyFile(versionPath, resolved.absolutePath);

    const restoredStat = await fs.stat(resolved.absolutePath);
    metadata.size = restoredStat.size;
    metadata.updatedAt = new Date().toISOString();

    await ctx.metadataManager.upsertFileEntry(resolved.directory, resolved.fileName, metadata);

    ctx.logger.info("Version restored", {
      fileName: resolved.fileName,
      versionId,
    });

    return {
      success: true,
      message: `Version "${versionId}" of "${resolved.fileName}" restored successfully`,
      filePath: resolved.absolutePath,
    };
  };
}
