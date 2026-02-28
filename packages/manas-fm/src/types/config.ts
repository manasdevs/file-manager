import type { StorageAdapter } from "../adapters/storage-adapter.js";

// ─── Storage Provider Configuration ────────────────────────────

/** S3-compatible cloud provider identifiers */
export type S3Provider =
  | "aws"
  | "gcs"
  | "digitalocean-spaces"
  | "backblaze"
  | "wasabi"
  | "minio"
  | "cloudflare"
  | "oracle"
  | "ibm"
  | "supabase"
  | "custom-s3";

/** Credentials for S3-compatible providers */
export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

/** Local file-system storage (default) */
export interface LocalStorageConfig {
  provider: "local";
}

/** S3-compatible storage (AWS, GCS, DigitalOcean, Backblaze, Wasabi, MinIO, Oracle, IBM, Supabase, etc.) */
export interface S3StorageConfig {
  provider: "s3";
  /** S3-compatible provider preset. Default: "aws" */
  s3Provider?: S3Provider;
  /** Bucket name */
  bucket: string;
  /** AWS region or equivalent */
  region?: string;
  /** Custom endpoint URL (required for non-AWS providers or custom-s3) */
  endpoint?: string;
  /** S3 credentials. If omitted, uses the SDK default credential chain. */
  credentials?: S3Credentials;
  /** Optional key prefix within the bucket (e.g. "uploads/") */
  prefix?: string;
  /** Force path-style URLs (required for MinIO, some providers). Default: false */
  forcePathStyle?: boolean;
}

/** Azure Blob Storage */
export interface AzureStorageConfig {
  provider: "azure";
  /** Connection string (takes precedence) */
  connectionString?: string;
  /** Storage account name (used with accountKey or SAS) */
  accountName?: string;
  /** Storage account key */
  accountKey?: string;
  /** Container name */
  container: string;
  /** Optional key prefix */
  prefix?: string;
}

/** Firebase Storage (uses Firebase Admin SDK) */
export interface FirebaseStorageConfig {
  provider: "firebase";
  /** Firebase storage bucket name (e.g. "my-project.appspot.com") */
  bucket: string;
  /** Optional key prefix */
  prefix?: string;
  /**
   * Path to a service account JSON file.
   * If omitted, uses GOOGLE_APPLICATION_CREDENTIALS env var or default credentials.
   */
  serviceAccountPath?: string;
}

/** Bring your own StorageAdapter implementation */
export interface CustomStorageConfig {
  provider: "custom";
  adapter: StorageAdapter;
}

/** Discriminated union of all supported storage configurations */
export type StorageConfig =
  | LocalStorageConfig
  | S3StorageConfig
  | AzureStorageConfig
  | FirebaseStorageConfig
  | CustomStorageConfig;

// ─── Core Configuration ────────────────────────────────────────

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
  /**
   * Override the storage backend for this specific slug.
   * When set, files for this slug are stored using this provider
   * instead of the global storage configuration.
   */
  storage?: StorageConfig;
}

/** Top-level configuration passed to createFileManager */
export interface ManasFmConfig {
  /**
   * Root storage directory path.
   * - For local storage: an absolute or relative filesystem path.
   * - For cloud storage: used as the key prefix (optional; overridden by per-provider `prefix`).
   */
  basePath: string;
  /**
   * Storage backend configuration.
   * Defaults to local filesystem when omitted.
   */
  storage?: StorageConfig;
  logging?: LoggingConfig;
  cleanup?: CleanupConfig;
  versioning?: GlobalVersioningConfig;
  compression?: GlobalCompressionConfig;
  zip?: GlobalZipConfig;
  fileNaming?: GlobalFileNamingConfig;
  slugs: Record<string, SlugConfig>;
}

/** Validated storage configuration with resolved provider settings */
export interface ValidatedStorageConfig {
  /** The storage provider type */
  provider: "local" | "s3" | "azure" | "firebase" | "custom";
  /** Whether the storage is a cloud/remote backend */
  isCloud: boolean;
  /** The original storage config (for adapter construction) */
  config: StorageConfig;
}

/** Internal validated/resolved config with all defaults filled */
export interface ValidatedConfig {
  basePath: string;
  storage: ValidatedStorageConfig;
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
  /** The resolved storage config for this slug (may differ from global) */
  storage: ValidatedStorageConfig;
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
