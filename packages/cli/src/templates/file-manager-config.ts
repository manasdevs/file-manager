import type { UserConfig, SlugInput } from "../types.js";

/**
 * Generate the lib/file-manager.ts configuration file content.
 */
export function generateFileManagerConfig(config: UserConfig, isTypeScript: boolean): string {
  const ext = isTypeScript ? "ts" : "js";
  const importType = isTypeScript ? "import type " : "import ";

  const lines: string[] = [];

  // Imports
  lines.push(`import { createFileManager } from "manas-fm";`);
  if (isTypeScript) {
    lines.push(`import type { FileManager, ManasFmConfig } from "manas-fm";`);
  }
  lines.push(`import * as path from "node:path";`);
  lines.push(``);

  // Config object
  if (isTypeScript) {
    lines.push(`const config: ManasFmConfig = {`);
  } else {
    lines.push(`const config = {`);
  }
  lines.push(
    `  basePath: path.join(process.cwd(), ${JSON.stringify(config.storagePath.replace(/^\.\//, ""))}),`,
  );
  lines.push(``);

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
