import * as path from "node:path";
import type { OperationContext } from "../types/internal.js";
import type { FileInput, UploadOptions } from "../types/common.js";
import type { UploadResult } from "../types/results.js";
import { ValidationError } from "../errors/validation-error.js";
import { OperationError } from "../errors/operation-error.js";
import {
  atomicWriteFile,
  ensureDirectory,
  fileExists,
  sanitizeFileName,
} from "../core/fs-utils.js";
import { runCompression } from "./compression.js";
import { runZip } from "./zip.js";

export function createUploadFile(ctx: OperationContext) {
  return async function uploadFile(
    slug: string,
    file: FileInput,
    options?: UploadOptions,
  ): Promise<UploadResult> {
    await ctx.cleanupManager.maybeRunCleanup();

    const slugConfig = ctx.pathResolver.getSlugConfig(slug);

    // Validate allowedTypes
    if (slugConfig.allowedTypes.length > 0 && !slugConfig.allowedTypes.includes(file.mimeType)) {
      throw new ValidationError(`File type "${file.mimeType}" is not allowed for slug "${slug}"`, {
        allowed: slugConfig.allowedTypes,
      });
    }

    // Validate maxSizeBytes
    if (file.size > slugConfig.maxSizeBytes) {
      throw new ValidationError(
        `File size ${file.size} bytes exceeds maximum ${slugConfig.maxSizeBytes} bytes for slug "${slug}"`,
        { maxSize: slugConfig.maxSizeBytes, actualSize: file.size },
      );
    }

    // Determine target path
    const targetDir = options?.subPath
      ? path.join(slugConfig.path, options.subPath)
      : slugConfig.path;
    await ensureDirectory(targetDir);

    const fileName = sanitizeFileName(options?.fileName ?? file.originalName);
    const targetPath = path.join(targetDir, fileName);

    // Path traversal check
    ctx.pathResolver.assertWithinBasePath(targetPath);

    // Handle existing file
    if (!options?.overwrite && (await fileExists(targetPath))) {
      throw new OperationError(
        `File "${fileName}" already exists. Use overwrite option or a different name.`,
        { filePath: targetPath },
      );
    }

    // Write file
    await atomicWriteFile(targetPath, file.buffer);

    // Prepare metadata
    const now = new Date().toISOString();
    const retentionExpiresAt = slugConfig.retentionDays
      ? new Date(Date.now() + slugConfig.retentionDays * 86400000).toISOString()
      : null;

    const variants: { compressed?: string; zip?: string } = {};

    // Run zip BEFORE compression (compression may delete the original if keepOriginal=false)
    if (slugConfig.zip) {
      try {
        const zipPath = await runZip(targetPath, slugConfig.zip, ctx);
        variants.zip = path.relative(targetDir, zipPath);
      } catch (error) {
        ctx.logger.error("Zip creation failed", {
          fileName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Run compression after zip
    if (slugConfig.compression) {
      try {
        const compressedPath = await runCompression(
          targetPath,
          file.buffer,
          slugConfig.compression,
          ctx,
        );
        variants.compressed = path.relative(targetDir, compressedPath);
      } catch (error) {
        ctx.logger.error("Compression failed", {
          fileName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Save metadata
    await ctx.metadataManager.upsertFileEntry(targetDir, fileName, {
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      createdAt: now,
      updatedAt: now,
      slug,
      versions: [],
      variants,
      retentionExpiresAt,
    });

    ctx.logger.info("File uploaded", { slug, fileName, size: file.size });

    // Determine the actual file path to return (may differ if compression deleted original)
    let resultFilePath = targetPath;
    if (variants.compressed && slugConfig.compression && !slugConfig.compression.keepOriginal) {
      resultFilePath = path.resolve(targetDir, variants.compressed);
    }

    return {
      success: true,
      filePath: resultFilePath,
      fileName,
      slug,
      size: file.size,
      mimeType: file.mimeType,
      createdAt: now,
      variants: Object.keys(variants).length > 0 ? variants : undefined,
    };
  };
}
