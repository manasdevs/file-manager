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
