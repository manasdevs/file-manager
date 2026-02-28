import type { OperationContext } from "../types/internal.js";
import type { FileIdentifier, RenameOptions } from "../types/common.js";
import type { OperationResult } from "../types/results.js";
import { FileNotFoundError } from "../errors/file-not-found-error.js";
import { OperationError } from "../errors/operation-error.js";

export function createRenameFile(ctx: OperationContext) {
  return async function renameFile(
    identifier: FileIdentifier,
    newName: string,
    options?: RenameOptions,
  ): Promise<OperationResult> {
    await ctx.cleanupManager.maybeRunCleanup();

    const resolved = ctx.pathResolver.resolveFilePath(identifier);

    if (!(await ctx.storage.fileExists(resolved.absolutePath))) {
      throw new FileNotFoundError(`File not found: ${resolved.fileName}`, {
        path: resolved.absolutePath,
      });
    }

    const newPath = ctx.pathResolver.join(resolved.directory, newName);
    ctx.pathResolver.assertWithinBasePath(newPath);

    if (await ctx.storage.fileExists(newPath)) {
      throw new OperationError(`A file named "${newName}" already exists`, {
        targetPath: newPath,
      });
    }

    // Rename the main file
    await ctx.storage.moveFile(resolved.absolutePath, newPath);

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
        if (await ctx.storage.fileExists(oldVersionPath)) {
          await ctx.storage.moveFile(oldVersionPath, newVersionPath);
        }
      }
    }

    // Rename variants if requested
    if (options?.renameVariants && metadata?.variants) {
      const slugConfig = resolved.slug ? ctx.pathResolver.getSlugConfig(resolved.slug) : null;

      if (metadata.variants.compressed && slugConfig?.compression) {
        const oldCompressedPath = ctx.pathResolver.resolve(
          resolved.directory,
          metadata.variants.compressed,
        );
        const newCompressedPath = ctx.pathResolver.getCompressedPath(newPath, slugConfig);
        if (await ctx.storage.fileExists(oldCompressedPath)) {
          await ctx.storage.moveFile(oldCompressedPath, newCompressedPath);
          // Update variant path in metadata
          const updatedMeta = { ...metadata };
          updatedMeta.variants = {
            ...updatedMeta.variants,
            compressed: ctx.pathResolver.relative(resolved.directory, newCompressedPath),
          };
          await ctx.metadataManager.upsertFileEntry(resolved.directory, newName, updatedMeta);
        }
      }

      if (metadata.variants.zip && slugConfig?.zip) {
        const oldZipPath = ctx.pathResolver.resolve(resolved.directory, metadata.variants.zip);
        const newZipPath = ctx.pathResolver.getZipPath(newPath, slugConfig);
        if (await ctx.storage.fileExists(oldZipPath)) {
          await ctx.storage.moveFile(oldZipPath, newZipPath);
          const currentMeta = await ctx.metadataManager.getFileEntry(resolved.directory, newName);
          if (currentMeta) {
            currentMeta.variants = {
              ...currentMeta.variants,
              zip: ctx.pathResolver.relative(resolved.directory, newZipPath),
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
