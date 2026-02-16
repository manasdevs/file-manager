import * as path from "node:path";
import type {
  ManasFmConfig,
  ValidatedConfig,
  ResolvedSlugConfig,
  ResolvedCompressionConfig,
  ResolvedZipConfig,
  FileNamingStrategy,
} from "../types/config.js";
import { ConfigError } from "../errors/config-error.js";

const VALID_FILE_NAMING_STRATEGIES: readonly FileNamingStrategy[] = [
  "original",
  "uuid",
  "name-uuid",
  "name-number",
  "name-timestamp",
  "timestamp",
];

/** Validate user config and produce a fully resolved ValidatedConfig */
export async function validateConfig(config: ManasFmConfig): Promise<ValidatedConfig> {
  if (!config) {
    throw new ConfigError("Configuration is required");
  }

  if (!config.basePath || typeof config.basePath !== "string") {
    throw new ConfigError("basePath is required and must be a non-empty string");
  }
  const basePath = path.resolve(config.basePath);

  if (!config.slugs || typeof config.slugs !== "object") {
    throw new ConfigError("slugs is required and must be an object");
  }
  const slugKeys = Object.keys(config.slugs);
  if (slugKeys.length === 0) {
    throw new ConfigError("At least one slug must be defined");
  }

  const globalVersioningEnabled = config.versioning?.enabledByDefault ?? false;
  const globalMaxVersions = config.versioning?.maxVersions ?? 10;
  const globalCompressionEnabled = config.compression?.enabledByDefault ?? false;
  const globalZipEnabled = config.zip?.enabledByDefault ?? false;
  const globalFileNamingStrategy: FileNamingStrategy = config.fileNaming?.strategy ?? "original";

  if (
    config.fileNaming?.strategy !== undefined &&
    !VALID_FILE_NAMING_STRATEGIES.includes(config.fileNaming.strategy)
  ) {
    throw new ConfigError(
      `fileNaming.strategy must be one of: ${VALID_FILE_NAMING_STRATEGIES.join(", ")}`,
    );
  }

  const resolvedSlugs: Record<string, ResolvedSlugConfig> = {};
  let compressionNeeded = false;

  for (const [key, slugConfig] of Object.entries(config.slugs)) {
    if (!slugConfig.path || typeof slugConfig.path !== "string") {
      throw new ConfigError(`Slug "${key}": path is required and must be a non-empty string`);
    }

    if (slugConfig.maxSizeBytes !== undefined && slugConfig.maxSizeBytes <= 0) {
      throw new ConfigError(`Slug "${key}": maxSizeBytes must be a positive number`);
    }

    if (slugConfig.retentionDays !== undefined && slugConfig.retentionDays <= 0) {
      throw new ConfigError(`Slug "${key}": retentionDays must be a positive number`);
    }

    if (
      slugConfig.compression?.quality !== undefined &&
      (slugConfig.compression.quality < 1 || slugConfig.compression.quality > 100)
    ) {
      throw new ConfigError(`Slug "${key}": compression quality must be between 1 and 100`);
    }

    const versioningEnabled = slugConfig.versioning?.enabled ?? globalVersioningEnabled;
    const maxVersions = slugConfig.versioning?.maxVersions ?? globalMaxVersions;

    let compression: ResolvedCompressionConfig | null = null;
    const compressionEnabled = slugConfig.compression?.enabled ?? globalCompressionEnabled;
    if (compressionEnabled) {
      compressionNeeded = true;
      compression = {
        enabled: true,
        keepOriginal: slugConfig.compression?.keepOriginal ?? true,
        outputPath: slugConfig.compression?.outputPath ?? "compressed",
        quality: slugConfig.compression?.quality ?? 80,
        format: slugConfig.compression?.format ?? "webp",
      };
    }

    let zip: ResolvedZipConfig | null = null;
    const zipEnabled = slugConfig.zip?.enabled ?? globalZipEnabled;
    if (zipEnabled) {
      zip = {
        enabled: true,
        keepOriginal: slugConfig.zip?.keepOriginal ?? true,
        outputPath: slugConfig.zip?.outputPath ?? "archive",
      };
    }

    const fileNamingStrategy: FileNamingStrategy =
      slugConfig.fileNaming?.strategy ?? globalFileNamingStrategy;
    if (
      slugConfig.fileNaming?.strategy !== undefined &&
      !VALID_FILE_NAMING_STRATEGIES.includes(slugConfig.fileNaming.strategy)
    ) {
      throw new ConfigError(
        `Slug "${key}": fileNaming.strategy must be one of: ${VALID_FILE_NAMING_STRATEGIES.join(", ")}`,
      );
    }

    resolvedSlugs[key] = {
      path: path.resolve(basePath, slugConfig.path),
      allowedTypes: slugConfig.allowedTypes ?? [],
      maxSizeBytes: slugConfig.maxSizeBytes ?? Infinity,
      retentionDays: slugConfig.retentionDays ?? null,
      versioning: { enabled: versioningEnabled, maxVersions },
      compression,
      zip,
      fileNaming: { strategy: fileNamingStrategy },
    };
  }

  if (compressionNeeded) {
    try {
      await import("sharp");
    } catch {
      throw new ConfigError(
        "Compression is enabled but 'sharp' is not installed. Install it with: npm install sharp",
      );
    }
  }

  const logging = {
    enabled: config.logging?.enabled ?? false,
    level: config.logging?.level ?? ("info" as const),
    filePath: config.logging?.filePath,
  };

  const intervalHours = config.cleanup?.intervalHours ?? 24;
  if (config.cleanup?.intervalHours !== undefined && intervalHours <= 0) {
    throw new ConfigError("cleanup.intervalHours must be a positive number");
  }

  const cleanup = {
    enabled: config.cleanup?.enabled ?? false,
    intervalHours,
  };

  const versioning = {
    enabledByDefault: globalVersioningEnabled,
    maxVersions: globalMaxVersions,
  };

  return {
    basePath,
    logging,
    cleanup,
    versioning,
    slugs: resolvedSlugs,
  };
}
