import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { OperationContext } from "../types/internal.js";
import type { FileIdentifier, RenameOptions } from "../types/common.js";
import type { OperationResult } from "../types/results.js";
import { FileNotFoundError } from "../errors/file-not-found-error.js";
import { OperationError } from "../errors/operation-error.js";
import { fileExists } from "../core/fs-utils.js";

export function createRenameFile(ctx: OperationContext) {
  return async function renameFile(
    identifier: FileIdentifier,
    newName: string,
    options?: RenameOptions,
  ): Promise<OperationResult> {
    await ctx.cleanupManager.maybeRunCleanup();

    const resolved = ctx.pathResolver.resolveFilePath(identifier);

    if (!(await fileExists(resolved.absolutePath))) {
      throw new FileNotFoundError(`File not found: ${resolved.fileName}`, {
        path: resolved.absolutePath,
      });
    }

    const newPath = path.join(resolved.directory, newName);
    ctx.pathResolver.assertWithinBasePath(newPath);

    if (await fileExists(newPath)) {
      throw new OperationError(`A file named "${newName}" already exists`, {
        targetPath: newPath,
      });
    }

    // Rename the main file
    await fs.rename(resolved.absolutePath, newPath);

    // Rename metadata entry
    await ctx.metadataManager.renameFileEntry(resolved.directory, resolved.fileName, newName);

    // Get metadata for versions/variants info
    const metadata = await ctx.metadataManager.getFileEntry(resolved.directory, newName);

    // Rename versions if requested
    if (options?.renameVersions && metadata?.versions) {
      for (const version of metadata.versions) {
        const versionNum = parseInt(version.versionId.replace("v", ""), 10);
        const oldVersionPath = ctx.pathResolver.getVersionPath(resolved.absolutePath, versionNum);
        const newVersionPath = ctx.pathResolver.getVersionPath(newPath, versionNum);
        if (await fileExists(oldVersionPath)) {
          await fs.rename(oldVersionPath, newVersionPath);
        }
      }
    }

    // Rename variants if requested
    if (options?.renameVariants && metadata?.variants) {
      const slugConfig = resolved.slug ? ctx.pathResolver.getSlugConfig(resolved.slug) : null;

      if (metadata.variants.compressed && slugConfig?.compression) {
        const oldCompressedPath = path.resolve(resolved.directory, metadata.variants.compressed);
        const newCompressedPath = ctx.pathResolver.getCompressedPath(newPath, slugConfig);
        if (await fileExists(oldCompressedPath)) {
          await fs.rename(oldCompressedPath, newCompressedPath);
          // Update variant path in metadata
          const updatedMeta = { ...metadata };
          updatedMeta.variants = {
            ...updatedMeta.variants,
            compressed: path.relative(resolved.directory, newCompressedPath),
          };
          await ctx.metadataManager.upsertFileEntry(resolved.directory, newName, updatedMeta);
        }
      }

      if (metadata.variants.zip && slugConfig?.zip) {
        const oldZipPath = path.resolve(resolved.directory, metadata.variants.zip);
        const newZipPath = ctx.pathResolver.getZipPath(newPath, slugConfig);
        if (await fileExists(oldZipPath)) {
          await fs.rename(oldZipPath, newZipPath);
          const currentMeta = await ctx.metadataManager.getFileEntry(resolved.directory, newName);
          if (currentMeta) {
            currentMeta.variants = {
              ...currentMeta.variants,
              zip: path.relative(resolved.directory, newZipPath),
            };
            await ctx.metadataManager.upsertFileEntry(resolved.directory, newName, currentMeta);
          }
        }
      }
    }

    ctx.logger.info("File renamed", { oldName: resolved.fileName, newName });

    return {
      success: true,
      message: `File renamed from "${resolved.fileName}" to "${newName}"`,
      filePath: newPath,
    };
  };
}
