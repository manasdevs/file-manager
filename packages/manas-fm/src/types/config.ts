/** Global logging configuration */
export interface LoggingConfig {
  enabled: boolean;
  level?: "info" | "warn" | "error" | "debug";
  filePath?: string;
}

/** Global cleanup/retention configuration */
export interface CleanupConfig {
  enabled: boolean;
  intervalHours: number;
}

/** Global versioning defaults */
export interface GlobalVersioningConfig {
  enabledByDefault: boolean;
  maxVersions?: number;
}

/** Global compression defaults */
export interface GlobalCompressionConfig {
  enabledByDefault?: boolean;
}

/** Global zip defaults */
export interface GlobalZipConfig {
  enabledByDefault?: boolean;
}

/** Available file naming strategies */
export type FileNamingStrategy =
  | "original"
  | "uuid"
  | "name-uuid"
  | "name-number"
  | "name-timestamp"
  | "timestamp";

/** Global file naming configuration */
export interface GlobalFileNamingConfig {
  strategy: FileNamingStrategy;
}

/** Per-slug file naming override */
export interface SlugFileNamingConfig {
  strategy: FileNamingStrategy;
}

/** Per-slug versioning override */
export interface SlugVersioningConfig {
  enabled: boolean;
  maxVersions?: number;
}

/** Per-slug compression configuration */
export interface SlugCompressionConfig {
  enabled: boolean;
  keepOriginal: boolean;
  outputPath?: string;
  quality?: number;
  format?: "jpeg" | "webp" | "png";
}

/** Per-slug zip configuration */
export interface SlugZipConfig {
  enabled: boolean;
  keepOriginal: boolean;
  outputPath?: string;
}

/** Configuration for a single upload type (slug/key) */
export interface SlugConfig {
  path: string;
  allowedTypes?: string[];
  maxSizeBytes?: number;
  retentionDays?: number;
  versioning?: SlugVersioningConfig;
  compression?: SlugCompressionConfig;
  zip?: SlugZipConfig;
  fileNaming?: SlugFileNamingConfig;
}

/** Top-level configuration passed to createFileManager */
export interface ManasFmConfig {
  basePath: string;
  logging?: LoggingConfig;
  cleanup?: CleanupConfig;
  versioning?: GlobalVersioningConfig;
  compression?: GlobalCompressionConfig;
  zip?: GlobalZipConfig;
  fileNaming?: GlobalFileNamingConfig;
  slugs: Record<string, SlugConfig>;
}

/** Internal validated/resolved config with all defaults filled */
export interface ValidatedConfig {
  basePath: string;
  logging: ResolvedLoggingConfig;
  cleanup: Required<CleanupConfig>;
  versioning: Required<GlobalVersioningConfig>;
  slugs: Record<string, ResolvedSlugConfig>;
}

/** Resolved logging config with level always present */
export interface ResolvedLoggingConfig {
  enabled: boolean;
  level: "info" | "warn" | "error" | "debug";
  filePath?: string;
}

/** Slug config after merging with global defaults */
export interface ResolvedSlugConfig {
  path: string;
  allowedTypes: string[];
  maxSizeBytes: number;
  retentionDays: number | null;
  versioning: { enabled: boolean; maxVersions: number };
  compression: ResolvedCompressionConfig | null;
  zip: ResolvedZipConfig | null;
  fileNaming: ResolvedFileNamingConfig;
}

export interface ResolvedCompressionConfig {
  enabled: boolean;
  keepOriginal: boolean;
  outputPath: string;
  quality: number;
  format: "jpeg" | "webp" | "png";
}

export interface ResolvedZipConfig {
  enabled: boolean;
  keepOriginal: boolean;
  outputPath: string;
}

export interface ResolvedFileNamingConfig {
  strategy: FileNamingStrategy;
}
