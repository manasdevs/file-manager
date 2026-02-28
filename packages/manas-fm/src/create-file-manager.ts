import type { ManasFmConfig, ValidatedStorageConfig } from "./types/config.js";
import type { FileIdentifier, FolderIdentifier, FileInput } from "./types/common.js";
import type {
  UploadOptions,
  UpdateOptions,
  DeleteOptions,
  RenameOptions,
  MoveOptions,
  DuplicateOptions,
  DownloadOptions,
} from "./types/common.js";
import type {
  UploadResult,
  DownloadResult,
  FileInfo,
  FileListItem,
  FolderListItem,
  VersionInfo,
  OperationResult,
} from "./types/results.js";
import type { OperationContext } from "./types/internal.js";
import type { StorageAdapter } from "./adapters/storage-adapter.js";
import { validateConfig } from "./core/config-validator.js";
import { PathResolver } from "./core/path-resolver.js";
import { MetadataManager } from "./core/metadata-manager.js";
import { CleanupManager } from "./core/cleanup-manager.js";
import { Logger } from "./core/logger.js";
import { LocalStorageAdapter } from "./adapters/local.js";
import { RouterStorageAdapter } from "./adapters/router.js";
import { createUploadFile } from "./operations/upload.js";
import { createDownloadFile } from "./operations/download.js";
import { createListFiles } from "./operations/list-files.js";
import { createListFolders } from "./operations/list-folders.js";
import { createGetFileInfo } from "./operations/get-file-info.js";
import { createDeleteFile } from "./operations/delete.js";
import { createUpdateFile } from "./operations/update.js";
import { createRenameFile } from "./operations/rename.js";
import { createMoveFile } from "./operations/move.js";
import { createDuplicateFile } from "./operations/duplicate.js";
import { createListVersions, createRestoreVersion } from "./operations/versioning.js";

/** The file manager instance returned by createFileManager */
export interface FileManager {
  uploadFile: (slug: string, file: FileInput, options?: UploadOptions) => Promise<UploadResult>;
  downloadFile: (identifier: FileIdentifier, options?: DownloadOptions) => Promise<DownloadResult>;
  listFiles: (identifier: FolderIdentifier) => Promise<FileListItem[]>;
  listFolders: (identifier: FolderIdentifier) => Promise<FolderListItem[]>;
  getFileInfo: (identifier: FileIdentifier) => Promise<FileInfo>;
  deleteFile: (identifier: FileIdentifier, options?: DeleteOptions) => Promise<OperationResult>;
  updateFile: (
    identifier: FileIdentifier,
    newFile: FileInput,
    options?: UpdateOptions,
  ) => Promise<UploadResult>;
  renameFile: (
    identifier: FileIdentifier,
    newName: string,
    options?: RenameOptions,
  ) => Promise<OperationResult>;
  moveFile: (
    identifier: FileIdentifier,
    target: FolderIdentifier,
    options?: MoveOptions,
  ) => Promise<OperationResult>;
  duplicateFile: (
    identifier: FileIdentifier,
    target?: FolderIdentifier,
    options?: DuplicateOptions,
  ) => Promise<OperationResult>;
  listVersions: (identifier: FileIdentifier) => Promise<VersionInfo[]>;
  restoreVersion: (identifier: FileIdentifier, versionId: string) => Promise<OperationResult>;
}

/**
 * Create a file manager instance with the given configuration.
 *
 * Validates the config, initializes all internal services, and returns
 * an object with all file management utility functions.
 *
 * @example
 * ```ts
 * const fm = await createFileManager({
 *   basePath: "./storage",
 *   slugs: {
 *     profilePicture: {
 *       path: "profile-pictures",
 *       allowedTypes: ["image/jpeg", "image/png"],
 *       maxSizeBytes: 5 * 1024 * 1024,
 *     },
 *   },
 * });
 *
 * const result = await fm.uploadFile("profilePicture", fileInput);
 * ```
 */
export async function createFileManager(config: ManasFmConfig): Promise<FileManager> {
  // Validate and resolve config
  const validatedConfig = await validateConfig(config);

  // Create the global storage adapter
  const globalStorage = await createStorageAdapter(
    validatedConfig.storage,
    validatedConfig.basePath,
  );

  // Build per-slug adapters for slugs that override the global storage
  const slugAdapters = new Map<string, StorageAdapter>();
  for (const [slug, slugConfig] of Object.entries(validatedConfig.slugs)) {
    // Only create a separate adapter when the slug has its own storage config
    if (slugConfig.storage !== validatedConfig.storage) {
      slugAdapters.set(
        slug,
        await createStorageAdapter(slugConfig.storage, slugConfig.path),
      );
    }
  }

  // Create core services
  const logger = new Logger({
    ...validatedConfig.logging,
    basePath: validatedConfig.basePath,
  });
  const pathResolver = new PathResolver(validatedConfig);

  // The routing adapter transparently forwards each file operation to the
  // correct backend — per-slug override when available, global otherwise.
  const storage =
    slugAdapters.size > 0
      ? new RouterStorageAdapter(globalStorage, slugAdapters, pathResolver)
      : globalStorage;

  const metadataManager = new MetadataManager(pathResolver, logger, storage);
  const cleanupManager = new CleanupManager(
    validatedConfig,
    metadataManager,
    pathResolver,
    logger,
    storage,
  );

  // Create shared context
  const ctx: OperationContext = {
    config: validatedConfig,
    pathResolver,
    metadataManager,
    cleanupManager,
    logger,
    storage,
  };

  // Ensure base directory / prefix exists
  await storage.ensureDirectory(validatedConfig.basePath);

  // Ensure all slug directories exist
  for (const slugConfig of Object.values(validatedConfig.slugs)) {
    await storage.ensureDirectory(slugConfig.path);
  }

  logger.info("File manager initialized", {
    basePath: validatedConfig.basePath,
    slugCount: Object.keys(validatedConfig.slugs).length,
    storageType: globalStorage.type,
    slugStorageOverrides: slugAdapters.size > 0 ? slugAdapters.size : undefined,
  });

  return {
    uploadFile: createUploadFile(ctx),
    downloadFile: createDownloadFile(ctx),
    listFiles: createListFiles(ctx),
    listFolders: createListFolders(ctx),
    getFileInfo: createGetFileInfo(ctx),
    deleteFile: createDeleteFile(ctx),
    updateFile: createUpdateFile(ctx),
    renameFile: createRenameFile(ctx),
    moveFile: createMoveFile(ctx),
    duplicateFile: createDuplicateFile(ctx),
    listVersions: createListVersions(ctx),
    restoreVersion: createRestoreVersion(ctx),
  };
}

/**
 * Create the appropriate StorageAdapter based on the validated storage config.
 * Cloud adapters use dynamic imports so their SDKs are optional peer dependencies.
 */
async function createStorageAdapter(
  storageConfig: ValidatedStorageConfig,
  basePath: string,
): Promise<StorageAdapter> {
  const cfg = storageConfig.config;
  switch (cfg.provider) {
    case "local":
      return new LocalStorageAdapter(basePath);

    case "s3": {
      const { S3StorageAdapter } = await import("./adapters/s3.js");
      return new S3StorageAdapter(cfg);
    }

    case "azure": {
      const { AzureBlobStorageAdapter } = await import("./adapters/azure.js");
      return new AzureBlobStorageAdapter(cfg);
    }

    case "firebase": {
      const { FirebaseStorageAdapter } = await import("./adapters/firebase.js");
      return new FirebaseStorageAdapter(cfg);
    }

    case "custom":
      return cfg.adapter;

    default:
      return new LocalStorageAdapter(basePath);
  }
}
