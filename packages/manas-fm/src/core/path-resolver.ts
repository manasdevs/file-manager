import * as path from "node:path";
import type { ValidatedConfig, ResolvedSlugConfig } from "../types/config.js";
import type { FileIdentifier, FolderIdentifier } from "../types/common.js";
import { ValidationError } from "../errors/validation-error.js";
import { PermissionError } from "../errors/permission-error.js";

export const METADATA_FILE = ".manasfm.index.json";

export interface ResolvedFilePath {
  absolutePath: string;
  directory: string;
  fileName: string;
  slug: string | null;
}

export class PathResolver {
  constructor(private readonly config: ValidatedConfig) {}

  /** Resolve a FileIdentifier to an absolute file path */
  resolveFilePath(identifier: FileIdentifier): ResolvedFilePath {
    if (typeof identifier === "string") {
      const absolutePath = path.resolve(identifier);
      this.assertWithinBasePath(absolutePath);
      const slug = this.resolveSlugFromPath(absolutePath);
      return {
        absolutePath,
        directory: path.dirname(absolutePath),
        fileName: path.basename(absolutePath),
        slug,
      };
    }

    const { slug, name } = identifier;
    const slugConfig = this.getSlugConfig(slug);
    const absolutePath = path.resolve(slugConfig.path, name);
    this.assertWithinBasePath(absolutePath);
    this.assertWithinSlugPath(absolutePath, slugConfig.path, slug);
    return {
      absolutePath,
      directory: path.dirname(absolutePath),
      fileName: path.basename(absolutePath),
      slug,
    };
  }

  /** Resolve a FolderIdentifier to an absolute directory path */
  resolveFolderPath(identifier: FolderIdentifier): string {
    if (typeof identifier === "string") {
      const absolutePath = path.resolve(identifier);
      this.assertWithinBasePath(absolutePath);
      return absolutePath;
    }

    const { slug, subPath } = identifier;
    const slugConfig = this.getSlugConfig(slug);
    const absolutePath = subPath ? path.resolve(slugConfig.path, subPath) : slugConfig.path;
    this.assertWithinBasePath(absolutePath);
    if (subPath) {
      this.assertWithinSlugPath(absolutePath, slugConfig.path, slug);
    }
    return absolutePath;
  }

  /** Get the slug's base directory */
  getSlugBasePath(slug: string): string {
    return this.getSlugConfig(slug).path;
  }

  /** Get the slug configuration */
  getSlugConfig(slug: string): ResolvedSlugConfig {
    const slugConfig = this.config.slugs[slug];
    if (!slugConfig) {
      throw new ValidationError(`Unknown slug: "${slug}"`, { slug });
    }
    return slugConfig;
  }

  /** Get the metadata index file path for a directory */
  getMetadataPath(dirPath: string): string {
    return path.join(dirPath, METADATA_FILE);
  }

  /** Get the version file path: photo.jpg + version 3 -> photo.v3.jpg */
  getVersionPath(filePath: string, versionNumber: number): string {
    const ext = path.extname(filePath);
    const nameWithoutExt = filePath.slice(0, filePath.length - ext.length);
    return `${nameWithoutExt}.v${versionNumber}${ext}`;
  }

  /** Get the compressed variant path */
  getCompressedPath(filePath: string, slugConfig: ResolvedSlugConfig): string {
    if (!slugConfig.compression) {
      throw new ValidationError("Compression is not configured for this slug");
    }
    const dir = path.dirname(filePath);
    const fileName = path.basename(filePath);
    const ext = path.extname(fileName);
    const nameWithoutExt = fileName.slice(0, fileName.length - ext.length);
    const compressedDir = path.resolve(dir, slugConfig.compression.outputPath);
    const newExt = `.${slugConfig.compression.format}`;
    return path.join(compressedDir, `${nameWithoutExt}${newExt}`);
  }

  /** Get the zip variant path */
  getZipPath(filePath: string, slugConfig: ResolvedSlugConfig): string {
    if (!slugConfig.zip) {
      throw new ValidationError("Zip is not configured for this slug");
    }
    const dir = path.dirname(filePath);
    const fileName = path.basename(filePath);
    const zipDir = path.resolve(dir, slugConfig.zip.outputPath);
    return path.join(zipDir, `${fileName}.zip`);
  }

  /** Validate that a resolved path is within basePath (prevent path traversal) */
  assertWithinBasePath(resolvedPath: string): void {
    const normalized = path.resolve(resolvedPath);
    const normalizedBase = path.resolve(this.config.basePath);
    if (!normalized.startsWith(normalizedBase + path.sep) && normalized !== normalizedBase) {
      throw new PermissionError("Path traversal detected: path is outside the base directory", {
        path: resolvedPath,
        basePath: this.config.basePath,
      });
    }
  }

  /** Validate that a resolved path is within a specific slug's directory */
  assertWithinSlugPath(resolvedPath: string, slugPath: string, slug: string): void {
    const normalized = path.resolve(resolvedPath);
    const normalizedSlug = path.resolve(slugPath);
    if (!normalized.startsWith(normalizedSlug + path.sep) && normalized !== normalizedSlug) {
      throw new PermissionError(
        `Path traversal detected: path escapes the "${slug}" slug directory`,
        { path: resolvedPath, slugPath },
      );
    }
  }

  /** Determine which slug a given absolute path belongs to (reverse lookup) */
  resolveSlugFromPath(absolutePath: string): string | null {
    const normalized = path.resolve(absolutePath);
    for (const [slug, slugConfig] of Object.entries(this.config.slugs)) {
      const slugBase = path.resolve(slugConfig.path);
      if (normalized.startsWith(slugBase + path.sep) || normalized === slugBase) {
        return slug;
      }
    }
    return null;
  }
}
