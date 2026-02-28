import * as path from "node:path";
import type {
  ManasFmConfig,
  ValidatedConfig,
  ValidatedStorageConfig,
  ResolvedSlugConfig,
  ResolvedCompressionConfig,
  ResolvedZipConfig,
  FileNamingStrategy,
  StorageConfig,
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

  // ── Resolve storage configuration ──
  const storageConfig = validateStorageConfig(config.storage);
  const isCloud = storageConfig.isCloud;

  // For local storage, basePath is a filesystem directory.
  // For cloud storage, basePath is a key prefix (no path.resolve).
  const basePath = isCloud ? normalizeCloudPrefix(config.basePath) : path.resolve(config.basePath);

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

    // ── Per-slug storage resolution ──
    // If the slug declares its own storage, validate and use it.
    // Otherwise inherit the global storage configuration.
    let slugStorage: ValidatedStorageConfig;
    let slugPath: string;
    if (slugConfig.storage) {
      slugStorage = validateStorageConfig(slugConfig.storage);
      // Path is resolved relative to the slug's own storage root, not the global basePath.
      slugPath = slugStorage.isCloud
        ? normalizeCloudPrefix(slugConfig.path)
        : path.resolve(slugConfig.path);
    } else {
      slugStorage = storageConfig;
      slugPath = isCloud
        ? joinCloudKeys(basePath, slugConfig.path)
        : path.resolve(basePath, slugConfig.path);
    }

    resolvedSlugs[key] = {
      path: slugPath,
      allowedTypes: slugConfig.allowedTypes ?? [],
      maxSizeBytes: slugConfig.maxSizeBytes ?? Infinity,
      retentionDays: slugConfig.retentionDays ?? null,
      versioning: { enabled: versioningEnabled, maxVersions },
      compression,
      zip,
      fileNaming: { strategy: fileNamingStrategy },
      storage: slugStorage,
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
    storage: storageConfig,
    logging,
    cleanup,
    versioning,
    slugs: resolvedSlugs,
  };
}

// ── Storage config validation ─────────────────────────────────

function validateStorageConfig(storage: StorageConfig | undefined): ValidatedStorageConfig {
  if (!storage || storage.provider === "local") {
    return {
      provider: "local",
      isCloud: false,
      config: storage ?? { provider: "local" },
    };
  }

  switch (storage.provider) {
    case "s3": {
      if (!storage.bucket) {
        throw new ConfigError("S3 storage requires a 'bucket' name");
      }
      return { provider: "s3", isCloud: true, config: storage };
    }

    case "azure": {
      if (!storage.container) {
        throw new ConfigError("Azure storage requires a 'container' name");
      }
      if (!storage.connectionString && !storage.accountName) {
        throw new ConfigError("Azure storage requires either 'connectionString' or 'accountName'");
      }
      return { provider: "azure", isCloud: true, config: storage };
    }

    case "firebase": {
      if (!storage.bucket) {
        throw new ConfigError("Firebase storage requires a 'bucket' name");
      }
      return { provider: "firebase", isCloud: true, config: storage };
    }

    case "custom": {
      if (!storage.adapter) {
        throw new ConfigError("Custom storage requires an 'adapter' implementation");
      }
      // Determine if custom adapter is cloud-like (not local)
      const isCloud = storage.adapter.type !== "local";
      return { provider: "custom", isCloud, config: storage };
    }

    default:
      throw new ConfigError(
        `Unknown storage provider: ${(storage as { provider: string }).provider}`,
      );
  }
}

// ── Cloud key helpers ─────────────────────────────────────────

/** Normalize a cloud key prefix: strip leading slashes, ensure trailing slash */
function normalizeCloudPrefix(prefix: string): string {
  let key = prefix.replace(/\\/g, "/").replace(/^\/+/, "");
  // Remove "./" prefix common in local paths
  if (key.startsWith("./")) key = key.slice(2);
  if (key && !key.endsWith("/")) key += "/";
  return key;
}

/** Join cloud key segments with `/` separator */
function joinCloudKeys(...parts: string[]): string {
  return parts
    .map((p) => p.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, ""))
    .filter(Boolean)
    .join("/");
}
