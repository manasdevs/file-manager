export interface SlugInput {
  name: string;
  path: string;
  allowedTypes: string[];
  maxSizeMB: number;
  enableCompression: boolean;
  compressionFormat?: "jpeg" | "webp" | "png";
  compressionQuality?: number;
  enableZip: boolean;
  retentionDays?: number;
}

export interface UserConfig {
  storagePath: string;
  enableLogging: boolean;
  logLevel: "info" | "warn" | "error" | "debug";
  enableVersioning: boolean;
  maxVersions: number;
  fileNaming: "original" | "uuid" | "name-uuid" | "name-number" | "name-timestamp" | "timestamp";
  slugs: SlugInput[];
  setupApiRoute: boolean;
  setupServerActions: boolean;
  setupUploadProgress: boolean;
}
