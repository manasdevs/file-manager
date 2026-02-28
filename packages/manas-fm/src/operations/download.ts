import type { OperationContext } from "../types/internal.js";
import type { FileIdentifier, DownloadOptions } from "../types/common.js";
import type { DownloadResult } from "../types/results.js";
import { FileNotFoundError } from "../errors/file-not-found-error.js";
import { ValidationError } from "../errors/validation-error.js";

/** MIME type lookup by extension */
const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".xml": "application/xml",
  ".zip": "application/zip",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function getMimeType(filePath: string): string {
  const lastDot = filePath.lastIndexOf(".");
  const ext = lastDot > 0 ? filePath.slice(lastDot).toLowerCase() : "";
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

export function createDownloadFile(ctx: OperationContext) {
  return async function downloadFile(
    identifier: FileIdentifier,
    options?: DownloadOptions,
  ): Promise<DownloadResult> {
    await ctx.cleanupManager.maybeRunCleanup();

    const resolved = ctx.pathResolver.resolveFilePath(identifier);

    if (!(await ctx.storage.fileExists(resolved.absolutePath))) {
      throw new FileNotFoundError(`File not found: ${resolved.fileName}`, {
        path: resolved.absolutePath,
      });
    }

    // Determine which file to download based on variant option
    let downloadPath = resolved.absolutePath;
    const variant = options?.variant ?? "original";

    if (variant !== "original") {
      const metadata = await ctx.metadataManager.getFileEntry(
        resolved.directory,
        resolved.fileName,
      );

      if (variant === "compressed" && metadata?.variants.compressed) {
        downloadPath = ctx.pathResolver.resolve(resolved.directory, metadata.variants.compressed);
      } else if (variant === "zip" && metadata?.variants.zip) {
        downloadPath = ctx.pathResolver.resolve(resolved.directory, metadata.variants.zip);
      } else {
        throw new ValidationError(
          `Variant "${variant}" is not available for file "${resolved.fileName}"`,
          { availableVariants: metadata?.variants },
        );
      }

      if (!(await ctx.storage.fileExists(downloadPath))) {
        throw new FileNotFoundError(`Variant file not found: ${downloadPath}`, {
          path: downloadPath,
          variant,
        });
      }
    }

    const buffer = await ctx.storage.readFile(downloadPath);

    // Use metadata mimeType for original, infer for variants
    let mimeType: string;
    if (variant === "original") {
      const metadata = await ctx.metadataManager.getFileEntry(
        resolved.directory,
        resolved.fileName,
      );
      mimeType = metadata?.mimeType ?? getMimeType(downloadPath);
    } else {
      mimeType = getMimeType(downloadPath);
    }

    ctx.logger.info("File downloaded", { fileName: resolved.fileName, variant });

    return {
      buffer,
      fileName: ctx.pathResolver.basename(downloadPath),
      mimeType,
      size: buffer.length,
    };
  };
}
