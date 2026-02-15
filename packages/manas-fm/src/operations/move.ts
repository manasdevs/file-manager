import * as path from "node:path";
import type { OperationContext } from "../types/internal.js";
import type { FileIdentifier, FolderIdentifier, MoveOptions } from "../types/common.js";
import type { OperationResult } from "../types/results.js";
import { FileNotFoundError } from "../errors/file-not-found-error.js";
import { OperationError } from "../errors/operation-error.js";
import { fileExists, moveFile as fsMove, ensureDirectory } from "../core/fs-utils.js";

export function createMoveFile(ctx: OperationContext) {
  return async function moveFile(
    identifier: FileIdentifier,
    target: FolderIdentifier,
    options?: MoveOptions,
  ): Promise<OperationResult> {
    await ctx.cleanupManager.maybeRunCleanup();

    const resolved = ctx.pathResolver.resolveFilePath(identifier);
    const targetDir = ctx.pathResolver.resolveFolderPath(target);

    if (!(await fileExists(resolved.absolutePath))) {
      throw new FileNotFoundError(`File not found: ${resolved.fileName}`, {
        path: resolved.absolutePath,
      });
    }

    await ensureDirectory(targetDir);

    const targetPath = path.join(targetDir, resolved.fileName);

    if (!options?.overwrite && (await fileExists(targetPath))) {
      throw new OperationError(
        `A file named "${resolved.fileName}" already exists in the target directory`,
        { targetPath },
      );
    }

    // Move main file
    await fsMove(resolved.absolutePath, targetPath);

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
          if (await fileExists(oldVersionPath)) {
            await fsMove(oldVersionPath, newVersionPath);
          }
        }
      }
    }

    // Move variants if requested
    if (options?.moveVariants) {
      const metadata = await ctx.metadataManager.getFileEntry(targetDir, resolved.fileName);
      if (metadata?.variants) {
        if (metadata.variants.compressed) {
          const oldPath = path.resolve(resolved.directory, metadata.variants.compressed);
          const slugConfig = resolved.slug ? ctx.pathResolver.getSlugConfig(resolved.slug) : null;
          if (slugConfig?.compression && (await fileExists(oldPath))) {
            const newCompressedPath = ctx.pathResolver.getCompressedPath(targetPath, slugConfig);
            await ensureDirectory(path.dirname(newCompressedPath));
            await fsMove(oldPath, newCompressedPath);
            metadata.variants.compressed = path.relative(targetDir, newCompressedPath);
          }
        }
        if (metadata.variants.zip) {
          const oldPath = path.resolve(resolved.directory, metadata.variants.zip);
          const slugConfig = resolved.slug ? ctx.pathResolver.getSlugConfig(resolved.slug) : null;
          if (slugConfig?.zip && (await fileExists(oldPath))) {
            const newZipPath = ctx.pathResolver.getZipPath(targetPath, slugConfig);
            await ensureDirectory(path.dirname(newZipPath));
            await fsMove(oldPath, newZipPath);
            metadata.variants.zip = path.relative(targetDir, newZipPath);
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
