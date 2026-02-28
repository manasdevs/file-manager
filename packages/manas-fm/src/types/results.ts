export interface UploadResult {
  success: true;
  filePath: string;
  fileName: string;
  slug: string;
  size: number;
  mimeType: string;
  createdAt: string;
  /** Public URL for the uploaded file (available when using cloud storage) */
  url?: string;
  variants?: {
    compressed?: string;
    zip?: string;
  };
}

export interface DownloadResult {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
  /** Public URL for the file (available when using cloud storage) */
  url?: string;
  versions?: VersionInfo[];
  retentionExpiresAt?: string | null;
  variants?: {
    original?: string;
    compressed?: string;
    zip?: string;
  };
}

export interface FileListItem {
  name: string;
  path: string;
  size: number;
  mimeType: string;
  createdAt: string;
  /** Public URL for the file (available when using cloud storage) */
  url?: string;
}

export interface FolderListItem {
  name: string;
  path: string;
}

export interface VersionInfo {
  versionId: string;
  path: string;
  createdAt: string;
  size: number;
}

export interface OperationResult {
  success: true;
  message: string;
  filePath?: string;
}
