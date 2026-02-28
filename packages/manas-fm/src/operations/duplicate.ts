import type { OperationContext, FileMetadataEntry } from "../types/internal.js";
import type { FileIdentifier, FolderIdentifier, DuplicateOptions } from "../types/common.js";
import type { OperationResult } from "../types/results.js";
import { FileNotFoundError } from "../errors/file-not-found-error.js";
import { OperationError } from "../errors/operation-error.js";
import { generateUniqueName, generateFileName } from "../core/fs-utils.js";

export function createDuplicateFile(ctx: OperationContext) {
  return async function duplicateFile(
    identifier: FileIdentifier,
    target?: FolderIdentifier,
    options?: DuplicateOptions,
  ): Promise<OperationResult> {
    await ctx.cleanupManager.maybeRunCleanup();

    const resolved = ctx.pathResolver.resolveFilePath(identifier);

    if (!(await ctx.storage.fileExists(resolved.absolutePath))) {
      throw new FileNotFoundError(`File not found: ${resolved.fileName}`, {
        path: resolved.absolutePath,
      });
    }

    // Determine target directory
    const targetDir = target ? ctx.pathResolver.resolveFolderPath(target) : resolved.directory;
    await ctx.storage.ensureDirectory(targetDir);

    // Read source metadata early (needed for naming strategy base name)
    const metadata = await ctx.metadataManager.getFileEntry(resolved.directory, resolved.fileName);

    // Determine new file name
    let newFileName: string;
    if (options?.newName) {
      newFileName = options.newName;
      const candidatePath = ctx.pathResolver.join(targetDir, newFileName);
      if (await ctx.storage.fileExists(candidatePath)) {
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

      const items = await ctx.storage.listFiles(targetDir).catch(() => []);
      const existingNames = new Set(items.map((i) => i.name));

      if (namingStrategy === "original") {
        newFileName = generateUniqueName(resolved.fileName, existingNames);
      } else {
        const baseName = metadata?.originalName ?? resolved.fileName;
        newFileName = generateFileName(baseName, namingStrategy, existingNames);
      }
    }

    const newPath = ctx.pathResolver.join(targetDir, newFileName);
    ctx.pathResolver.assertWithinBasePath(newPath);

    // Copy file
    await ctx.storage.copyFile(resolved.absolutePath, newPath);

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
          const srcVariant = ctx.pathResolver.resolve(
            resolved.directory,
            metadata.variants.compressed,
          );
          const slugConfig = resolved.slug ? ctx.pathResolver.getSlugConfig(resolved.slug) : null;
          if (slugConfig?.compression && (await ctx.storage.fileExists(srcVariant))) {
            const destVariant = ctx.pathResolver.getCompressedPath(newPath, slugConfig);
            await ctx.storage.ensureDirectory(ctx.pathResolver.dirname(destVariant));
            await ctx.storage.copyFile(srcVariant, destVariant);
            newMetadata.variants.compressed = ctx.pathResolver.relative(targetDir, destVariant);
          }
        }
        if (metadata.variants.zip) {
          const srcVariant = ctx.pathResolver.resolve(resolved.directory, metadata.variants.zip);
          const slugConfig = resolved.slug ? ctx.pathResolver.getSlugConfig(resolved.slug) : null;
          if (slugConfig?.zip && (await ctx.storage.fileExists(srcVariant))) {
            const destVariant = ctx.pathResolver.getZipPath(newPath, slugConfig);
            await ctx.storage.ensureDirectory(ctx.pathResolver.dirname(destVariant));
            await ctx.storage.copyFile(srcVariant, destVariant);
            newMetadata.variants.zip = ctx.pathResolver.relative(targetDir, destVariant);
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
