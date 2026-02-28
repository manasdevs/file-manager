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

export type StorageProvider =
  | "local"
  | "aws"
  | "gcs"
  | "digitalocean-spaces"
  | "backblaze"
  | "wasabi"
  | "minio"
  | "oracle"
  | "ibm"
  | "supabase"
  | "cloudflare"
  | "azure"
  | "firebase";

export interface CloudStorageInput {
  provider: StorageProvider;
  /** S3-compatible providers */
  bucket?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
  keyPrefix?: string;
  /** Azure */
  connectionString?: string;
  containerName?: string;
  /** Firebase */
  firebaseBucket?: string;
}

export interface UserConfig {
  storagePath: string;
  storageProvider: StorageProvider;
  cloudStorage?: CloudStorageInput;
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
