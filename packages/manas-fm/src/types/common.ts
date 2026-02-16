/**
 * Union type for identifying a file.
 * Either an absolute/relative path string, or a slug-based identifier.
 */
export type FileIdentifier = string | { slug: string; name: string };

/**
 * Union type for identifying a folder.
 */
export type FolderIdentifier = string | { slug: string; subPath?: string };

/** Represents the file input (what the user provides to upload/update) */
export interface FileInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

/** Phases of the upload pipeline, reported via onProgress */
export type UploadPhase =
  | "validating"
  | "writing"
  | "zipping"
  | "compressing"
  | "saving-metadata"
  | "complete";

/** Progress event emitted during upload */
export interface UploadProgressEvent {
  /** Current phase of the upload pipeline */
  phase: UploadPhase;
  /** Overall progress percentage (0–100) */
  percent: number;
  /** Human-readable description of the current phase */
  message?: string;
}

/** Options for upload operations */
export interface UploadOptions {
  fileName?: string;
  subPath?: string;
  overwrite?: boolean;
  /**
   * Called with progress updates during the server-side upload pipeline.
   * Phases: validating → writing → zipping → compressing → saving-metadata → complete
   */
  onProgress?: (event: UploadProgressEvent) => void;
}

/** Options for update operations */
export interface UpdateOptions {
  createVersion?: boolean;
}

/** Options for download operations */
export interface DownloadOptions {
  variant?: "original" | "compressed" | "zip";
}

/** Options for delete operations */
export interface DeleteOptions {
  deleteAllVersions?: boolean;
  deleteVariants?: boolean;
}

/** Options for rename operations */
export interface RenameOptions {
  renameVersions?: boolean;
  renameVariants?: boolean;
}

/** Options for move operations */
export interface MoveOptions {
  moveVersions?: boolean;
  moveVariants?: boolean;
  overwrite?: boolean;
}

/** Options for duplicate operations */
export interface DuplicateOptions {
  duplicateVariants?: boolean;
  newName?: string;
}
