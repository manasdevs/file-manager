import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { OperationContext, FileMetadataEntry } from "../types/internal.js";
import type { FileIdentifier, FolderIdentifier, DuplicateOptions } from "../types/common.js";
import type { OperationResult } from "../types/results.js";
import { FileNotFoundError } from "../errors/file-not-found-error.js";
import { OperationError } from "../errors/operation-error.js";
import {
  fileExists,
  copyFile,
  ensureDirectory,
  generateUniqueName,
  generateFileName,
} from "../core/fs-utils.js";

export function createDuplicateFile(ctx: OperationContext) {
  return async function duplicateFile(
    identifier: FileIdentifier,
    target?: FolderIdentifier,
    options?: DuplicateOptions,
  ): Promise<OperationResult> {
    await ctx.cleanupManager.maybeRunCleanup();

    const resolved = ctx.pathResolver.resolveFilePath(identifier);

    if (!(await fileExists(resolved.absolutePath))) {
      throw new FileNotFoundError(`File not found: ${resolved.fileName}`, {
        path: resolved.absolutePath,
      });
    }

    // Determine target directory
    const targetDir = target ? ctx.pathResolver.resolveFolderPath(target) : resolved.directory;
    await ensureDirectory(targetDir);

    // Read source metadata early (needed for naming strategy base name)
    const metadata = await ctx.metadataManager.getFileEntry(resolved.directory, resolved.fileName);

    // Determine new file name
    let newFileName: string;
    if (options?.newName) {
      newFileName = options.newName;
      const candidatePath = path.join(targetDir, newFileName);
      if (await fileExists(candidatePath)) {
        throw new OperationError(`File "${newFileName}" already exists in the target directory`, {
          filePath: candidatePath,
        });
      }
    } else {
      // Determine naming strategy from target slug
      const targetSlug = target
        ? typeof target === "string"
          ? resolved.slug
          : target.slug
        : resolved.slug;
      const targetSlugConfig = targetSlug ? ctx.pathResolver.getSlugConfig(targetSlug) : null;
      const namingStrategy = targetSlugConfig?.fileNaming.strategy ?? "original";

      const entries = await fs.readdir(targetDir);
      const existingNames = new Set(entries);

      if (namingStrategy === "original") {
        newFileName = generateUniqueName(resolved.fileName, existingNames);
      } else {
        const baseName = metadata?.originalName ?? resolved.fileName;
        newFileName = generateFileName(baseName, namingStrategy, existingNames);
      }
    }

    const newPath = path.join(targetDir, newFileName);
    ctx.pathResolver.assertWithinBasePath(newPath);

    // Copy file
    await copyFile(resolved.absolutePath, newPath);

    // Copy metadata
    if (metadata) {
      const now = new Date().toISOString();
      const newMetadata: FileMetadataEntry = {
        ...metadata,
        createdAt: now,
        updatedAt: now,
        versions: [], // Duplicated file starts fresh with no versions
        variants: {},
      };

      // Duplicate variants if requested
      if (options?.duplicateVariants && metadata.variants) {
        if (metadata.variants.compressed) {
          const srcVariant = path.resolve(resolved.directory, metadata.variants.compressed);
          const slugConfig = resolved.slug ? ctx.pathResolver.getSlugConfig(resolved.slug) : null;
          if (slugConfig?.compression && (await fileExists(srcVariant))) {
            const destVariant = ctx.pathResolver.getCompressedPath(newPath, slugConfig);
            await ensureDirectory(path.dirname(destVariant));
            await copyFile(srcVariant, destVariant);
            newMetadata.variants.compressed = path.relative(targetDir, destVariant);
          }
        }
        if (metadata.variants.zip) {
          const srcVariant = path.resolve(resolved.directory, metadata.variants.zip);
          const slugConfig = resolved.slug ? ctx.pathResolver.getSlugConfig(resolved.slug) : null;
          if (slugConfig?.zip && (await fileExists(srcVariant))) {
            const destVariant = ctx.pathResolver.getZipPath(newPath, slugConfig);
            await ensureDirectory(path.dirname(destVariant));
            await copyFile(srcVariant, destVariant);
            newMetadata.variants.zip = path.relative(targetDir, destVariant);
          }
        }
      }

      await ctx.metadataManager.upsertFileEntry(targetDir, newFileName, newMetadata);
    }

    ctx.logger.info("File duplicated", {
      original: resolved.fileName,
      duplicate: newFileName,
      targetDir,
    });

    return {
      success: true,
      message: `File duplicated as "${newFileName}"`,
      filePath: newPath,
    };
  };
}
