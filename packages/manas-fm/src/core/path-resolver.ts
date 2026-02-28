import * as path from "node:path";
import type { ValidatedConfig, ResolvedSlugConfig } from "../types/config.js";
import type { FileIdentifier, FolderIdentifier } from "../types/common.js";
import { ValidationError } from "../errors/validation-error.js";
import { PermissionError } from "../errors/permission-error.js";

export const METADATA_FILE = ".manasfm.index.json";

export interface ResolvedFilePath {
  /** The absolute local path OR cloud key */
  absolutePath: string;
  /** Parent directory or prefix */
  directory: string;
  fileName: string;
  slug: string | null;
}

export class PathResolver {
  /** True when the global storage backend is cloud / remote */
  private readonly isCloud: boolean;

  constructor(private readonly config: ValidatedConfig) {
    this.isCloud = config.storage.isCloud;
  }

  /** Returns true if the given slug uses a different storage from the global one */
  private hasPerSlugStorage(slug: string): boolean {
    const slugCfg = this.config.slugs[slug];
    if (!slugCfg) return false;
    return slugCfg.storage !== this.config.storage;
  }

  /** Returns the effective isCloud flag for a specific slug */
  private slugIsCloud(slug: string): boolean {
    return this.config.slugs[slug]?.storage?.isCloud ?? this.isCloud;
  }

  // ─── Public helpers ─────────────────────────────────────────

  /** Join path segments appropriately for the current storage mode */
  join(...segments: string[]): string {
    if (this.isCloud) {
      return segments
        .map((s) => s.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, ""))
        .filter(Boolean)
        .join("/");
    }
    return path.join(...segments);
  }

  /** Get the directory/prefix of a key */
  dirname(key: string): string {
    if (this.isCloud) {
      const parts = key.replace(/\\/g, "/").split("/");
      parts.pop();
      return parts.join("/");
    }
    return path.dirname(key);
  }

  /** Get the file name from a key */
  basename(key: string): string {
    if (this.isCloud) {
      const parts = key.replace(/\\/g, "/").split("/");
      return parts[parts.length - 1] || "";
    }
    return path.basename(key);
  }

  /** Get the extension from a key */
  extname(key: string): string {
    const name = this.basename(key);
    const dotIdx = name.lastIndexOf(".");
    return dotIdx > 0 ? name.slice(dotIdx) : "";
  }

  /** Resolve a key to an absolute path. For cloud, this is an identity (keys are already absolute). */
  resolve(...segments: string[]): string {
    if (this.isCloud) {
      return this.join(...segments);
    }
    return path.resolve(...segments);
  }

  /** Get relative path from a base to a target */
  relative(from: string, to: string): string {
    if (this.isCloud) {
      // Strip the `from` prefix from `to`
      const normFrom = from.replace(/\\/g, "/").replace(/\/+$/, "") + "/";
      const normTo = to.replace(/\\/g, "/");
      if (normTo.startsWith(normFrom)) {
        return normTo.slice(normFrom.length);
      }
      return normTo;
    }
    return path.relative(from, to);
  }

  // ─── Identifier Resolution ─────────────────────────────────

  /** Resolve a FileIdentifier to a path/key */
  resolveFilePath(identifier: FileIdentifier): ResolvedFilePath {
    if (typeof identifier === "string") {
      const absolutePath = this.resolve(identifier);
      this.assertWithinBasePath(absolutePath);
      const slug = this.resolveSlugFromPath(absolutePath);
      return {
        absolutePath,
        directory: this.dirname(absolutePath),
        fileName: this.basename(absolutePath),
        slug,
      };
    }

    const { slug, name } = identifier;
    const slugConfig = this.getSlugConfig(slug);
    const absolutePath = this.join(slugConfig.path, name);
    this.assertWithinBasePath(absolutePath, slug);
    if (!this.slugIsCloud(slug)) {
      this.assertWithinSlugPath(absolutePath, slugConfig.path, slug);
    }
    return {
      absolutePath,
      directory: this.dirname(absolutePath),
      fileName: this.basename(absolutePath),
      slug,
    };
  }

  /** Resolve a FolderIdentifier to a path/key */
  resolveFolderPath(identifier: FolderIdentifier): string {
    if (typeof identifier === "string") {
      const absolutePath = this.resolve(identifier);
      this.assertWithinBasePath(absolutePath);
      return absolutePath;
    }

    const { slug, subPath } = identifier;
    const slugConfig = this.getSlugConfig(slug);
    const absolutePath = subPath ? this.join(slugConfig.path, subPath) : slugConfig.path;
    this.assertWithinBasePath(absolutePath, slug);
    if (!this.slugIsCloud(slug) && subPath) {
      this.assertWithinSlugPath(absolutePath, slugConfig.path, slug);
    }
    return absolutePath;
  }

  /** Get the slug's base directory / prefix */
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

  /** Get the metadata index file path/key for a directory */
  getMetadataPath(dirPath: string): string {
    return this.join(dirPath, METADATA_FILE);
  }

  /** Get the version file path: photo.jpg + version 3 -> photo.v3.jpg */
  getVersionPath(filePath: string, versionNumber: number): string {
    const ext = this.extname(filePath);
    const nameWithoutExt = filePath.slice(0, filePath.length - ext.length);
    return `${nameWithoutExt}.v${versionNumber}${ext}`;
  }

  /** Get the compressed variant path */
  getCompressedPath(filePath: string, slugConfig: ResolvedSlugConfig): string {
    if (!slugConfig.compression) {
      throw new ValidationError("Compression is not configured for this slug");
    }
    const dir = this.dirname(filePath);
    const fileName = this.basename(filePath);
    const ext = this.extname(fileName);
    const nameWithoutExt = fileName.slice(0, fileName.length - ext.length);
    const effectiveIsCloud = slugConfig.storage.isCloud;
    const compressedDir = effectiveIsCloud
      ? this.join(dir, slugConfig.compression.outputPath)
      : path.resolve(dir, slugConfig.compression.outputPath);
    const newExt = `.${slugConfig.compression.format}`;
    return this.join(compressedDir, `${nameWithoutExt}${newExt}`);
  }

  /** Get the zip variant path */
  getZipPath(filePath: string, slugConfig: ResolvedSlugConfig): string {
    if (!slugConfig.zip) {
      throw new ValidationError("Zip is not configured for this slug");
    }
    const dir = this.dirname(filePath);
    const fileName = this.basename(filePath);
    const effectiveIsCloud = slugConfig.storage.isCloud;
    const zipDir = effectiveIsCloud
      ? this.join(dir, slugConfig.zip.outputPath)
      : path.resolve(dir, slugConfig.zip.outputPath);
    return this.join(zipDir, `${fileName}.zip`);
  }

  /** Validate that a resolved path is within basePath (prevent path traversal).
   *  When `slug` is provided and has per-slug storage, validates against the slug's
   *  own root instead of the global basePath. */
  assertWithinBasePath(resolvedPath: string, slug?: string): void {
    // For per-slug storage, validate against the slug's own root path
    if (slug && this.hasPerSlugStorage(slug)) {
      const slugCfg = this.config.slugs[slug]!;
      if (slugCfg.storage.isCloud) {
        const normPath = resolvedPath.replace(/\\/g, "/");
        const normBase = slugCfg.path.replace(/\\/g, "/").replace(/\/+$/, "");
        if (normBase && !normPath.startsWith(normBase)) {
          throw new PermissionError(
            "Path traversal detected: path is outside the slug's storage prefix",
            { path: resolvedPath, slugPath: slugCfg.path },
          );
        }
      } else {
        const normalized = path.resolve(resolvedPath);
        const normalizedBase = path.resolve(slugCfg.path);
        if (!normalized.startsWith(normalizedBase + path.sep) && normalized !== normalizedBase) {
          throw new PermissionError(
            "Path traversal detected: path is outside the slug's storage directory",
            { path: resolvedPath, slugPath: slugCfg.path },
          );
        }
      }
      return;
    }

    if (this.isCloud) {
      // For cloud storage, just ensure the key starts with the basePath prefix
      const normPath = resolvedPath.replace(/\\/g, "/");
      const normBase = this.config.basePath.replace(/\\/g, "/").replace(/\/+$/, "");
      if (normBase && !normPath.startsWith(normBase)) {
        throw new PermissionError("Path traversal detected: path is outside the base prefix", {
          path: resolvedPath,
          basePath: this.config.basePath,
        });
      }
      return;
    }
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

  /** Determine which slug a given path belongs to (reverse lookup) */
  resolveSlugFromPath(absolutePath: string): string | null {
    const normPath = absolutePath.replace(/\\/g, "/");
    for (const [slug, slugConfig] of Object.entries(this.config.slugs)) {
      if (slugConfig.storage.isCloud) {
        const slugBase = slugConfig.path.replace(/\\/g, "/");
        if (normPath.startsWith(slugBase + "/") || normPath === slugBase) {
          return slug;
        }
      } else {
        const normalized = path.resolve(absolutePath);
        const slugBase = path.resolve(slugConfig.path);
        if (normalized.startsWith(slugBase + path.sep) || normalized === slugBase) {
          return slug;
        }
      }
    }
    return null;
  }
}
