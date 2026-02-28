import { createFileManager } from "manas-fm";
import type { FileManager, ManasFmConfig } from "manas-fm";
import * as path from "node:path";

/**
 * Example: per-slug storage overrides.
 *
 * Each slug can use a completely different storage backend.
 * The global `storage` field acts as the default for any slug that
 * does not declare its own `storage` key.
 *
 * This config uses:
 *   - `images`    → AWS S3
 *   - `avatars`   → Backblaze B2 (via S3-compatible preset)
 *   - `documents` → Azure Blob Storage
 *   - `uploads`   → local filesystem (inherits the global default)
 */
const config: ManasFmConfig = {
  basePath: path.join(process.cwd(), "storage"),

  // Global default storage — used by any slug without an explicit `storage` key.
  // Here all unspecified slugs fall back to local disk.
  // storage: { provider: "local" },  ← this is the implicit default

  logging: {
    enabled: true,
    level: "debug",
  },

  versioning: {
    enabledByDefault: true,
    maxVersions: 5,
  },

  fileNaming: {
    strategy: "original",
  },

  slugs: {
    // ── AWS S3 slug ─────────────────────────────────────────────
    images: {
      path: "images",
      allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      maxSizeBytes: 10 * 1024 * 1024,
      compression: {
        enabled: true,
        keepOriginal: true,
        quality: 75,
        format: "webp",
      },
      fileNaming: {
        strategy: "name-uuid",
      },
      storage: {
        provider: "s3",
        bucket: process.env.AWS_S3_IMAGES_BUCKET ?? "my-images-bucket",
        region: process.env.AWS_REGION ?? "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
        },
      },
    },

    // ── Backblaze B2 slug (S3-compatible) ───────────────────────
    avatars: {
      path: "avatars",
      allowedTypes: ["image/jpeg", "image/png", "image/webp"],
      maxSizeBytes: 5 * 1024 * 1024,
      fileNaming: {
        strategy: "uuid",
      },
      storage: {
        provider: "s3",
        preset: "backblaze",
        bucket: process.env.B2_BUCKET ?? "my-avatars-bucket",
        credentials: {
          accessKeyId: process.env.B2_KEY_ID ?? "",
          secretAccessKey: process.env.B2_APP_KEY ?? "",
        },
      },
    },

    // ── Azure Blob Storage slug ──────────────────────────────────
    documents: {
      path: "documents",
      allowedTypes: ["application/pdf", "text/plain", "application/json"],
      maxSizeBytes: 25 * 1024 * 1024,
      retentionDays: 90,
      zip: {
        enabled: true,
        keepOriginal: true,
      },
      storage: {
        provider: "azure",
        container: process.env.AZURE_CONTAINER ?? "documents",
        connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING ?? "",
      },
    },

    // ── Local filesystem slug (inherits global default) ──────────
    uploads: {
      path: "uploads",
      maxSizeBytes: 50 * 1024 * 1024,
      // No `storage` key → uses the global default (local disk)
    },
  },
};

const globalForFm = globalThis as typeof globalThis & {
  __manasFm?: Promise<FileManager>;
};

export function getFileManager(): Promise<FileManager> {
  if (!globalForFm.__manasFm) {
    globalForFm.__manasFm = createFileManager(config);
  }
  return globalForFm.__manasFm;
}
