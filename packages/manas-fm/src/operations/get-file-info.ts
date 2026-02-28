import type { OperationContext } from "../types/internal.js";
import type { FileIdentifier } from "../types/common.js";
import type { FileInfo, VersionInfo } from "../types/results.js";
import { FileNotFoundError } from "../errors/file-not-found-error.js";

export function createGetFileInfo(ctx: OperationContext) {
  return async function getFileInfo(identifier: FileIdentifier): Promise<FileInfo> {
    await ctx.cleanupManager.maybeRunCleanup();

    const resolved = ctx.pathResolver.resolveFilePath(identifier);

    if (!(await ctx.storage.fileExists(resolved.absolutePath))) {
      throw new FileNotFoundError(`File not found: ${resolved.fileName}`, {
        path: resolved.absolutePath,
      });
    }

    const stat = await ctx.storage.getFileStats(resolved.absolutePath);
    const metadata = await ctx.metadataManager.getFileEntry(resolved.directory, resolved.fileName);

    const versions: VersionInfo[] | undefined = metadata?.versions.map((v) => ({
      versionId: v.versionId,
      path: ctx.pathResolver.getVersionPath(
        resolved.absolutePath,
        parseInt(v.versionId.replace("v", ""), 10),
      ),
      createdAt: v.createdAt,
      size: v.size,
    }));

    const info: FileInfo = {
      name: resolved.fileName,
      path: resolved.absolutePath,
      size: stat?.size ?? 0,
      mimeType: metadata?.mimeType ?? "application/octet-stream",
      createdAt:
        metadata?.createdAt ?? stat?.lastModified.toISOString() ?? new Date().toISOString(),
      updatedAt:
        metadata?.updatedAt ?? stat?.lastModified.toISOString() ?? new Date().toISOString(),
    };

    if (versions && versions.length > 0) {
      info.versions = versions;
    }

    if (metadata?.retentionExpiresAt) {
      info.retentionExpiresAt = metadata.retentionExpiresAt;
    }

    if (metadata?.variants && (metadata.variants.compressed || metadata.variants.zip)) {
      info.variants = {
        original: resolved.absolutePath,
        compressed: metadata.variants.compressed
          ? ctx.pathResolver.resolve(resolved.directory, metadata.variants.compressed)
          : undefined,
        zip: metadata.variants.zip
          ? ctx.pathResolver.resolve(resolved.directory, metadata.variants.zip)
          : undefined,
      };
    }

    ctx.logger.debug("File info retrieved", { fileName: resolved.fileName });

    return info;
  };
}
