import type { OperationContext } from "../types/internal.js";
import type { FileIdentifier, FolderIdentifier, MoveOptions } from "../types/common.js";
import type { OperationResult } from "../types/results.js";
import { FileNotFoundError } from "../errors/file-not-found-error.js";
import { OperationError } from "../errors/operation-error.js";

export function createMoveFile(ctx: OperationContext) {
  return async function moveFile(
    identifier: FileIdentifier,
    target: FolderIdentifier,
    options?: MoveOptions,
  ): Promise<OperationResult> {
    await ctx.cleanupManager.maybeRunCleanup();

    const resolved = ctx.pathResolver.resolveFilePath(identifier);
    const targetDir = ctx.pathResolver.resolveFolderPath(target);

    if (!(await ctx.storage.fileExists(resolved.absolutePath))) {
      throw new FileNotFoundError(`File not found: ${resolved.fileName}`, {
        path: resolved.absolutePath,
      });
    }

    await ctx.storage.ensureDirectory(targetDir);

    const targetPath = ctx.pathResolver.join(targetDir, resolved.fileName);

    if (!options?.overwrite && (await ctx.storage.fileExists(targetPath))) {
      throw new OperationError(
        `A file named "${resolved.fileName}" already exists in the target directory`,
        { targetPath },
      );
    }

    // Move main file
    await ctx.storage.moveFile(resolved.absolutePath, targetPath);

    // Move metadata entry
    await ctx.metadataManager.moveFileEntry(resolved.directory, targetDir, resolved.fileName);

    // Move versions if requested
    if (options?.moveVersions) {
      const metadata = await ctx.metadataManager.getFileEntry(targetDir, resolved.fileName);
      if (metadata?.versions) {
        for (const version of metadata.versions) {
          const versionNum = parseInt(version.versionId.replace("v", ""), 10);
          const oldVersionPath = ctx.pathResolver.getVersionPath(resolved.absolutePath, versionNum);
          const newVersionPath = ctx.pathResolver.getVersionPath(targetPath, versionNum);
          if (await ctx.storage.fileExists(oldVersionPath)) {
            await ctx.storage.moveFile(oldVersionPath, newVersionPath);
          }
        }
      }
    }

    // Move variants if requested
    if (options?.moveVariants) {
      const metadata = await ctx.metadataManager.getFileEntry(targetDir, resolved.fileName);
      if (metadata?.variants) {
        if (metadata.variants.compressed) {
          const oldPath = ctx.pathResolver.resolve(
            resolved.directory,
            metadata.variants.compressed,
          );
          const slugConfig = resolved.slug ? ctx.pathResolver.getSlugConfig(resolved.slug) : null;
          if (slugConfig?.compression && (await ctx.storage.fileExists(oldPath))) {
            const newCompressedPath = ctx.pathResolver.getCompressedPath(targetPath, slugConfig);
            await ctx.storage.ensureDirectory(ctx.pathResolver.dirname(newCompressedPath));
            await ctx.storage.moveFile(oldPath, newCompressedPath);
            metadata.variants.compressed = ctx.pathResolver.relative(targetDir, newCompressedPath);
          }
        }
        if (metadata.variants.zip) {
          const oldPath = ctx.pathResolver.resolve(resolved.directory, metadata.variants.zip);
          const slugConfig = resolved.slug ? ctx.pathResolver.getSlugConfig(resolved.slug) : null;
          if (slugConfig?.zip && (await ctx.storage.fileExists(oldPath))) {
            const newZipPath = ctx.pathResolver.getZipPath(targetPath, slugConfig);
            await ctx.storage.ensureDirectory(ctx.pathResolver.dirname(newZipPath));
            await ctx.storage.moveFile(oldPath, newZipPath);
            metadata.variants.zip = ctx.pathResolver.relative(targetDir, newZipPath);
          }
        }
        await ctx.metadataManager.upsertFileEntry(targetDir, resolved.fileName, metadata);
      }
    }

    ctx.logger.info("File moved", {
      fileName: resolved.fileName,
      from: resolved.directory,
      to: targetDir,
    });

    return {
      success: true,
      message: `File "${resolved.fileName}" moved successfully`,
      filePath: targetPath,
    };
  };
}
