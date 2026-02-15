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

/** Options for upload operations */
export interface UploadOptions {
  fileName?: string;
  subPath?: string;
  overwrite?: boolean;
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
