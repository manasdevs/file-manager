import type { ManasFmConfig } from "./types/config.js";
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
import { validateConfig } from "./core/config-validator.js";
import { PathResolver } from "./core/path-resolver.js";
import { MetadataManager } from "./core/metadata-manager.js";
import { CleanupManager } from "./core/cleanup-manager.js";
import { Logger } from "./core/logger.js";
import { ensureDirectory } from "./core/fs-utils.js";
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

  // Create core services
  const logger = new Logger({
    ...validatedConfig.logging,
    basePath: validatedConfig.basePath,
  });
  const pathResolver = new PathResolver(validatedConfig);
  const metadataManager = new MetadataManager(pathResolver, logger);
  const cleanupManager = new CleanupManager(validatedConfig, metadataManager, pathResolver, logger);

  // Create shared context
  const ctx: OperationContext = {
    config: validatedConfig,
    pathResolver,
    metadataManager,
    cleanupManager,
    logger,
  };

  // Ensure base directory exists
  await ensureDirectory(validatedConfig.basePath);

  // Ensure all slug directories exist
  for (const slugConfig of Object.values(validatedConfig.slugs)) {
    await ensureDirectory(slugConfig.path);
  }

  logger.info("File manager initialized", {
    basePath: validatedConfig.basePath,
    slugCount: Object.keys(validatedConfig.slugs).length,
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
