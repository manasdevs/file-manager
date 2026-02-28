// Main factory
export { createFileManager } from "./create-file-manager.js";
export type { FileManager } from "./create-file-manager.js";

// Config types
export type {
  ManasFmConfig,
  SlugConfig,
  LoggingConfig,
  CleanupConfig,
  GlobalVersioningConfig,
  GlobalCompressionConfig,
  GlobalZipConfig,
  GlobalFileNamingConfig,
  SlugVersioningConfig,
  SlugCompressionConfig,
  SlugZipConfig,
  SlugFileNamingConfig,
  FileNamingStrategy,
  // Storage config types
  StorageConfig,
  LocalStorageConfig,
  S3StorageConfig,
  S3Provider,
  S3Credentials,
  AzureStorageConfig,
  FirebaseStorageConfig,
  CustomStorageConfig,
} from "./types/config.js";

// Result types
export type {
  UploadResult,
  DownloadResult,
  FileInfo,
  FileListItem,
  FolderListItem,
  VersionInfo,
  OperationResult,
} from "./types/results.js";

// Common types
export type {
  FileIdentifier,
  FolderIdentifier,
  FileInput,
  UploadOptions,
  UploadPhase,
  UploadProgressEvent,
  UpdateOptions,
  DeleteOptions,
  RenameOptions,
  MoveOptions,
  DuplicateOptions,
  DownloadOptions,
} from "./types/common.js";

// Framework adapters
export { toNextJsHandler } from "./adapters/nextjs.js";

// Storage adapters & types
export type {
  StorageAdapter,
  StorageFileStats,
  StorageListItem,
  StorageDirectoryItem,
} from "./adapters/storage-adapter.js";
export { LocalStorageAdapter } from "./adapters/local.js";
export { S3_PRESETS, resolveEndpoint } from "./adapters/s3-presets.js";
export type { S3Preset } from "./adapters/s3-presets.js";
// Cloud adapters are dynamically imported by createFileManager,
// but we re-export them for advanced use cases (e.g. custom composition).
export { S3StorageAdapter } from "./adapters/s3.js";
export { AzureBlobStorageAdapter } from "./adapters/azure.js";
export { FirebaseStorageAdapter } from "./adapters/firebase.js";

// Errors
export {
  ManasFmError,
  ConfigError,
  ValidationError,
  FileNotFoundError,
  PermissionError,
  StorageError,
  OperationError,
} from "./errors/index.js";
