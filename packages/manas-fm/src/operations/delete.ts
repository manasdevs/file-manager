import * as path from "node:path";
import type { OperationContext } from "../types/internal.js";
import type { FileIdentifier, DeleteOptions } from "../types/common.js";
import type { OperationResult } from "../types/results.js";
import { FileNotFoundError } from "../errors/file-not-found-error.js";
import { safeDeleteFile, fileExists } from "../core/fs-utils.js";

export function createDeleteFile(ctx: OperationContext) {
  return async function deleteFile(
    identifier: FileIdentifier,
    options?: DeleteOptions,
  ): Promise<OperationResult> {
    await ctx.cleanupManager.maybeRunCleanup();

    const resolved = ctx.pathResolver.resolveFilePath(identifier);

    if (!(await fileExists(resolved.absolutePath))) {
      throw new FileNotFoundError(`File not found: ${resolved.fileName}`, {
        path: resolved.absolutePath,
      });
    }

    // Get metadata before deletion
    const metadata = await ctx.metadataManager.getFileEntry(resolved.directory, resolved.fileName);

    // Delete main file
    await safeDeleteFile(resolved.absolutePath);

    // Delete versions if requested
    if (options?.deleteAllVersions && metadata?.versions) {
      for (const version of metadata.versions) {
        const versionNum = parseInt(version.versionId.replace("v", ""), 10);
        const versionPath = ctx.pathResolver.getVersionPath(resolved.absolutePath, versionNum);
        await safeDeleteFile(versionPath);
      }
    }

    // Delete variants if requested
    if (options?.deleteVariants && metadata?.variants) {
      if (metadata.variants.compressed) {
        await safeDeleteFile(path.resolve(resolved.directory, metadata.variants.compressed));
      }
      if (metadata.variants.zip) {
        await safeDeleteFile(path.resolve(resolved.directory, metadata.variants.zip));
      }
    }

    // Remove metadata
    await ctx.metadataManager.removeFileEntry(resolved.directory, resolved.fileName);

    ctx.logger.info("File deleted", {
      fileName: resolved.fileName,
      deleteAllVersions: options?.deleteAllVersions ?? false,
      deleteVariants: options?.deleteVariants ?? false,
    });

    return {
      success: true,
      message: `File "${resolved.fileName}" deleted successfully`,
      filePath: resolved.absolutePath,
    };
  };
}
