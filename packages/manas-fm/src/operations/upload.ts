import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { OperationContext } from "../types/internal.js";
import type { FileInput, UploadOptions, UploadPhase } from "../types/common.js";
import type { UploadResult } from "../types/results.js";
import { ValidationError } from "../errors/validation-error.js";
import { OperationError } from "../errors/operation-error.js";
import {
  atomicWriteFile,
  ensureDirectory,
  fileExists,
  sanitizeFileName,
  generateFileName,
} from "../core/fs-utils.js";
import { runCompression } from "./compression.js";
import { runZip } from "./zip.js";

/** Human-readable labels for each upload phase */
const PHASE_MESSAGES: Record<UploadPhase, string> = {
  validating: "Validating file...",
  writing: "Writing file to disk...",
  zipping: "Creating zip archive...",
  compressing: "Compressing image...",
  "saving-metadata": "Saving metadata...",
  complete: "Upload complete",
};

/**
 * Build a phase→percent mapping that dynamically adjusts based on which
 * optional steps (zip, compression) are active for this slug.
 */
function buildPhasePercents(hasZip: boolean, hasCompression: boolean): Record<UploadPhase, number> {
  // Allocate weights: validating=10, writing=30, zip=20, compression=20, metadata=10, complete=10
  // When optional phases are absent their weight is redistributed to "writing".
  let writingWeight = 30;
  const zipWeight = hasZip ? 20 : 0;
  const compressionWeight = hasCompression ? 20 : 0;
  writingWeight += (hasZip ? 0 : 20) + (hasCompression ? 0 : 20);

  let cumulative = 0;
  const validating = (cumulative += 10);
  const writing = (cumulative += writingWeight);
  const zipping = (cumulative += zipWeight);
  const compressing = (cumulative += compressionWeight);
  const savingMeta = (cumulative += 10);
  // whatever's left goes to complete (should always be 100)
  const complete = 100;

  return {
    validating,
    writing,
    zipping,
    compressing,
    "saving-metadata": savingMeta,
    complete,
  };
}

export function createUploadFile(ctx: OperationContext) {
  return async function uploadFile(
    slug: string,
    file: FileInput,
    options?: UploadOptions,
  ): Promise<UploadResult> {
    const notify = options?.onProgress;
    await ctx.cleanupManager.maybeRunCleanup();

    const slugConfig = ctx.pathResolver.getSlugConfig(slug);
    const phases = buildPhasePercents(!!slugConfig.zip, !!slugConfig.compression);

    const emitProgress = (phase: UploadPhase) => {
      notify?.({ phase, percent: phases[phase], message: PHASE_MESSAGES[phase] });
    };

    // ── Validate ──
    emitProgress("validating");

    if (slugConfig.allowedTypes.length > 0 && !slugConfig.allowedTypes.includes(file.mimeType)) {
      throw new ValidationError(`File type "${file.mimeType}" is not allowed for slug "${slug}"`, {
        allowed: slugConfig.allowedTypes,
      });
    }

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

    // Determine file name based on naming strategy
    const namingStrategy = slugConfig.fileNaming.strategy;
    let fileName: string;

    if (namingStrategy === "original") {
      fileName = sanitizeFileName(options?.fileName ?? file.originalName);
    } else {
      const entries = await fs.readdir(targetDir).catch(() => [] as string[]);
      const existingNames = new Set(entries);
      fileName = generateFileName(
        options?.fileName ?? file.originalName,
        namingStrategy,
        existingNames,
      );
    }

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

    // ── Write file ──
    emitProgress("writing");
    await atomicWriteFile(targetPath, file.buffer);

    // Prepare metadata
    const now = new Date().toISOString();
    const retentionExpiresAt = slugConfig.retentionDays
      ? new Date(Date.now() + slugConfig.retentionDays * 86400000).toISOString()
      : null;

    const variants: { compressed?: string; zip?: string } = {};

    // ── Zip ──
    if (slugConfig.zip) {
      emitProgress("zipping");
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

    // ── Compression ──
    if (slugConfig.compression) {
      emitProgress("compressing");
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

    // ── Save metadata ──
    emitProgress("saving-metadata");
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

    // ── Complete ──
    emitProgress("complete");

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
