/**
 * Endpoint presets for S3-compatible cloud storage providers.
 *
 * Each preset maps a provider identifier to the endpoint URL template
 * and any other provider-specific defaults.
 */
export interface S3Preset {
  /** Endpoint URL (may include `{region}` placeholder) */
  endpoint: string;
  /** Whether to use path-style URLs (bucket in path instead of subdomain) */
  forcePathStyle: boolean;
  /** Display name for logging / CLI */
  displayName: string;
}

/**
 * Built-in presets.  The `{region}` token is replaced at runtime with the
 * user-supplied region string.
 */
export const S3_PRESETS: Record<string, S3Preset> = {
  aws: {
    endpoint: "https://s3.{region}.amazonaws.com",
    forcePathStyle: false,
    displayName: "Amazon S3",
  },
  gcs: {
    endpoint: "https://storage.googleapis.com",
    forcePathStyle: true,
    displayName: "Google Cloud Storage",
  },
  "digitalocean-spaces": {
    endpoint: "https://{region}.digitaloceanspaces.com",
    forcePathStyle: false,
    displayName: "DigitalOcean Spaces",
  },
  backblaze: {
    endpoint: "https://s3.{region}.backblazeb2.com",
    forcePathStyle: false,
    displayName: "Backblaze B2",
  },
  wasabi: {
    endpoint: "https://s3.{region}.wasabisys.com",
    forcePathStyle: false,
    displayName: "Wasabi",
  },
  minio: {
    endpoint: "http://localhost:9000",
    forcePathStyle: true,
    displayName: "MinIO (self-hosted)",
  },
  oracle: {
    endpoint: "https://{region}.compat.objectstorage.{region}.oraclecloud.com",
    forcePathStyle: true,
    displayName: "Oracle Cloud Object Storage",
  },
  ibm: {
    endpoint: "https://s3.{region}.cloud-object-storage.appdomain.cloud",
    forcePathStyle: false,
    displayName: "IBM Cloud Object Storage",
  },
  supabase: {
    endpoint: "https://{region}.supabase.co/storage/v1/s3",
    forcePathStyle: true,
    displayName: "Supabase Storage",
  },
  cloudflare: {
    endpoint: "https://{region}.r2.cloudflarestorage.com",
    forcePathStyle: true,
    displayName: "Cloudflare R2",
  },
};

/** Resolve the endpoint URL by replacing {region} with the actual region. */
export function resolveEndpoint(template: string, region: string): string {
  return template.replace(/\{region\}/g, region);
}
