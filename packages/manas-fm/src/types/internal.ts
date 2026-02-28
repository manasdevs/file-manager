import type { ValidatedConfig } from "./config.js";
import type { PathResolver } from "../core/path-resolver.js";
import type { MetadataManager } from "../core/metadata-manager.js";
import type { CleanupManager } from "../core/cleanup-manager.js";
import type { Logger } from "../core/logger.js";
import type { StorageAdapter } from "../adapters/storage-adapter.js";

/** Shared context passed to all operation factory functions */
export interface OperationContext {
  config: ValidatedConfig;
  storage: StorageAdapter;
  pathResolver: PathResolver;
  metadataManager: MetadataManager;
  cleanupManager: CleanupManager;
  logger: Logger;
}

/** Structure of a .manasfm.index.json file */
export interface MetadataIndex {
  files: Record<string, FileMetadataEntry>;
}

/** Metadata entry for a single file */
export interface FileMetadataEntry {
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  slug: string;
  versions: VersionMetadataEntry[];
  variants: {
    compressed?: string;
    zip?: string;
  };
  retentionExpiresAt: string | null;
}

/** Version metadata entry (stored inside FileMetadataEntry) */
export interface VersionMetadataEntry {
  versionId: string;
  createdAt: string;
  size: number;
}
