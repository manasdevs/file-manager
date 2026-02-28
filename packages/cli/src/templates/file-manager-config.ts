import type { UserConfig, SlugInput } from "../types.js";

/**
 * Generate the lib/file-manager.ts configuration file content.
 */
export function generateFileManagerConfig(config: UserConfig, isTypeScript: boolean): string {
  const ext = isTypeScript ? "ts" : "js";
  const importType = isTypeScript ? "import type " : "import ";

  const lines: string[] = [];
  const isCloud = config.storageProvider !== "local";

  // Imports
  lines.push(`import { createFileManager } from "manas-fm";`);
  if (isTypeScript) {
    lines.push(`import type { FileManager, ManasFmConfig } from "manas-fm";`);
  }
  if (!isCloud) {
    lines.push(`import * as path from "node:path";`);
  }
  lines.push(``);

  // Config object
  if (isTypeScript) {
    lines.push(`const config: ManasFmConfig = {`);
  } else {
    lines.push(`const config = {`);
  }

  if (isCloud) {
    lines.push(`  basePath: ${JSON.stringify(config.storagePath.replace(/^\.\//, ""))},`);
  } else {
    lines.push(
      `  basePath: path.join(process.cwd(), ${JSON.stringify(config.storagePath.replace(/^\.\//, ""))}),`,
    );
  }
  lines.push(``);

  // Storage config for cloud providers
  if (isCloud && config.cloudStorage) {
    const cs = config.cloudStorage;
    const isS3 = !["azure", "firebase"].includes(cs.provider);

    if (isS3) {
      lines.push(`  storage: {`);
      lines.push(`    provider: "s3",`);
      lines.push(`    s3Provider: "${cs.provider}",`);
      lines.push(`    bucket: ${JSON.stringify(cs.bucket ?? "")},`);
      lines.push(`    region: ${JSON.stringify(cs.region ?? "us-east-1")},`);
      lines.push(`    credentials: {`);
      lines.push(`      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",`);
      lines.push(`      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",`);
      lines.push(`    },`);
      if (cs.endpoint) {
        lines.push(`    endpoint: ${JSON.stringify(cs.endpoint)},`);
      }
      if (cs.keyPrefix) {
        lines.push(`    prefix: ${JSON.stringify(cs.keyPrefix)},`);
      }
      lines.push(`  },`);
    } else if (cs.provider === "azure") {
      lines.push(`  storage: {`);
      lines.push(`    provider: "azure",`);
      lines.push(`    container: ${JSON.stringify(cs.containerName ?? "")},`);
      lines.push(`    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING ?? "",`);
      if (cs.keyPrefix) {
        lines.push(`    prefix: ${JSON.stringify(cs.keyPrefix)},`);
      }
      lines.push(`  },`);
    } else if (cs.provider === "firebase") {
      lines.push(`  storage: {`);
      lines.push(`    provider: "firebase",`);
      lines.push(`    bucket: ${JSON.stringify(cs.firebaseBucket ?? "")},`);
      if (cs.keyPrefix) {
        lines.push(`    prefix: ${JSON.stringify(cs.keyPrefix)},`);
      }
      lines.push(`  },`);
    }
    lines.push(``);
  }

  // Logging
  if (config.enableLogging) {
    lines.push(`  logging: {`);
    lines.push(`    enabled: true,`);
    lines.push(`    level: "${config.logLevel}",`);
    lines.push(`  },`);
    lines.push(``);
  }

  // Versioning
  if (config.enableVersioning) {
    lines.push(`  versioning: {`);
    lines.push(`    enabledByDefault: true,`);
    lines.push(`    maxVersions: ${config.maxVersions},`);
    lines.push(`  },`);
    lines.push(``);
  }

  // File naming
  if (config.fileNaming && config.fileNaming !== "original") {
    lines.push(`  fileNaming: {`);
    lines.push(`    strategy: "${config.fileNaming}",`);
    lines.push(`  },`);
    lines.push(``);
  }

  // Slugs
  lines.push(`  slugs: {`);
  for (const slug of config.slugs) {
    lines.push(`    ${slug.name}: {`);
    lines.push(`      path: "${slug.path}",`);

    if (slug.allowedTypes.length > 0) {
      lines.push(`      allowedTypes: ${JSON.stringify(slug.allowedTypes)},`);
    }

    lines.push(`      maxSizeBytes: ${slug.maxSizeMB} * 1024 * 1024,`);

    if (slug.retentionDays) {
      lines.push(`      retentionDays: ${slug.retentionDays},`);
    }

    if (slug.enableCompression) {
      lines.push(`      compression: {`);
      lines.push(`        enabled: true,`);
      lines.push(`        keepOriginal: true,`);
      if (slug.compressionQuality) {
        lines.push(`        quality: ${slug.compressionQuality},`);
      }
      if (slug.compressionFormat) {
        lines.push(`        format: "${slug.compressionFormat}",`);
      }
      lines.push(`      },`);
    }

    if (slug.enableZip) {
      lines.push(`      zip: {`);
      lines.push(`        enabled: true,`);
      lines.push(`        keepOriginal: true,`);
      lines.push(`      },`);
    }

    lines.push(`    },`);
  }
  lines.push(`  },`);
  lines.push(`};`);
  lines.push(``);

  // Singleton pattern
  if (isTypeScript) {
    lines.push(`const globalForFm = globalThis as typeof globalThis & {`);
    lines.push(`  __manasFm?: Promise<FileManager>;`);
    lines.push(`};`);
  } else {
    lines.push(`const globalForFm = globalThis;`);
  }
  lines.push(``);

  if (isTypeScript) {
    lines.push(`export function getFileManager(): Promise<FileManager> {`);
  } else {
    lines.push(`export function getFileManager() {`);
  }
  lines.push(`  if (!globalForFm.__manasFm) {`);
  lines.push(`    globalForFm.__manasFm = createFileManager(config);`);
  lines.push(`  }`);
  lines.push(`  return globalForFm.__manasFm;`);
  lines.push(`}`);
  lines.push(``);

  return lines.join("\n");
}
