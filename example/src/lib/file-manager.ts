import { createFileManager } from "manas-fm";
import type { FileManager, ManasFmConfig } from "manas-fm";
import * as path from "node:path";

const config: ManasFmConfig = {
  basePath: path.join(process.cwd(), "storage"),

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
    },

    documents: {
      path: "documents",
      allowedTypes: ["application/pdf", "text/plain", "application/json", "text/html", "text/css"],
      maxSizeBytes: 25 * 1024 * 1024,
      retentionDays: 90,
      zip: {
        enabled: true,
        keepOriginal: true,
      },
    },

    uploads: {
      path: "uploads",
      maxSizeBytes: 50 * 1024 * 1024,
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
