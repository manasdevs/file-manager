/**
 * Generate the manas-fm llms.txt documentation file.
 * This provides LLM-readable documentation for the library API.
 */
export function generateLlmsTxt(): string {
  return `# manas-fm

> A configuration-first file management library for Node.js and Next.js applications. Handles file uploads, downloads, versioning, compression, and more with a type-safe API.

Package: \`manas-fm\`
Repository: https://github.com/manasdevs/file-manager
License: MIT

## Overview

manas-fm organizes files using a **slug-based** architecture. You define named storage categories ("slugs") in configuration, each with its own path, allowed types, size limits, versioning, compression, and retention rules. The library resolves all paths, manages metadata, and handles file lifecycle automatically.

The factory function \`createFileManager(config)\` returns a \`FileManager\` instance with all operations. It is async because it validates config and ensures directories exist.

## Installation

\`\`\`bash
npm install manas-fm
# For image compression support:
npm install sharp
\`\`\`

## Configuration

The top-level config type is \`ManasFmConfig\`:

\`\`\`typescript
import { createFileManager } from "manas-fm";
import type { ManasFmConfig } from "manas-fm";

const config: ManasFmConfig = {
  // Required: absolute path to the root storage directory
  basePath: "/absolute/path/to/storage",

  // Optional: logging settings
  logging: {
    enabled: true,             // default: true
    level: "info",             // "info" | "warn" | "error" | "debug"
    filePath: "./logs/fm.log", // optional log file path
  },

  // Optional: automatic cleanup of expired files
  cleanup: {
    enabled: false,
    intervalHours: 24,
  },

  // Optional: global versioning defaults
  versioning: {
    enabledByDefault: false,
    maxVersions: 5,
  },

  // Optional: global compression defaults
  compression: {
    enabledByDefault: false,
  },

  // Optional: global zip defaults
  zip: {
    enabledByDefault: false,
  },

  // Optional: global file naming strategy (default: "original")
  fileNaming: {
    strategy: "original",   // "original" | "uuid" | "name-uuid" | "name-number" | "name-timestamp" | "timestamp"
  },

  // Required: at least one slug must be defined
  slugs: {
    images: {
      path: "images",                        // subdirectory under basePath
      allowedTypes: ["image/jpeg", "image/png", "image/webp"],
      maxSizeBytes: 10 * 1024 * 1024,        // 10MB
      retentionDays: 365,                    // optional auto-delete after N days
      versioning: { enabled: true, maxVersions: 3 },
      compression: {
        enabled: true,
        keepOriginal: true,
        quality: 75,                         // 0-100
        format: "webp",                      // "jpeg" | "webp" | "png"
        outputPath: "compressed",            // optional subdirectory for compressed files
      },
      zip: {
        enabled: false,
        keepOriginal: true,
        outputPath: "zipped",
      },
      fileNaming: { strategy: "name-uuid" }, // per-slug override
    },
    documents: {
      path: "documents",
      allowedTypes: ["application/pdf", "text/plain"],
      maxSizeBytes: 25 * 1024 * 1024,
    },
  },
};

const fm = await createFileManager(config);
\`\`\`

### SlugConfig fields

| Field           | Type                   | Required | Description                              |
|-----------------|------------------------|----------|------------------------------------------|
| \`path\`          | \`string\`               | Yes      | Subdirectory name under \`basePath\`       |
| \`allowedTypes\`  | \`string[]\`             | No       | MIME types allowed (all if omitted)      |
| \`maxSizeBytes\`  | \`number\`               | No       | Max file size in bytes                   |
| \`retentionDays\` | \`number\`               | No       | Auto-delete files after N days           |
| \`versioning\`    | \`SlugVersioningConfig\` | No       | Per-slug versioning override             |
| \`compression\`   | \`SlugCompressionConfig\`| No       | Per-slug compression config              |
| \`zip\`           | \`SlugZipConfig\`        | No       | Per-slug zip config                      |
| \`fileNaming\`    | \`SlugFileNamingConfig\` | No       | Per-slug file naming strategy override   |

## Core Types

### FileIdentifier
Used to identify a file in most operations:
\`\`\`typescript
type FileIdentifier = string | { slug: string; name: string };
\`\`\`

### FolderIdentifier
Used to identify a folder:
\`\`\`typescript
type FolderIdentifier = string | { slug: string; subPath?: string };
\`\`\`

### FileInput
The file data provided for upload/update:
\`\`\`typescript
interface FileInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}
\`\`\`

### UploadPhase
Phases reported during upload progress:
\`\`\`typescript
type UploadPhase = "validating" | "writing" | "zipping" | "compressing" | "saving-metadata" | "complete";
\`\`\`

### UploadProgressEvent
Progress event emitted during upload:
\`\`\`typescript
interface UploadProgressEvent {
  phase: UploadPhase;
  percent: number;     // 0\u2013100, monotonically increasing
  message?: string;    // Human-readable description
}
\`\`\`

### FileNamingStrategy
Controls how uploaded files are named on disk. Set globally or per-slug:
\`\`\`typescript
type FileNamingStrategy = "original" | "uuid" | "name-uuid" | "name-number" | "name-timestamp" | "timestamp";
\`\`\`

| Strategy         | Example Output                                      | Description                                     |
|------------------|-----------------------------------------------------|-------------------------------------------------|
| \`original\`      | \`photo.jpg\`                                        | Keep the original filename (default)            |
| \`uuid\`          | \`a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg\`        | Full random UUID                                |
| \`name-uuid\`     | \`photo-a1b2c3d4.jpg\`                               | Original name + 8-char UUID suffix              |
| \`name-number\`   | \`photo-1.jpg\`, \`photo-2.jpg\`                      | Original name + incrementing counter            |
| \`name-timestamp\` | \`photo-20260217-103000.jpg\`                        | Original name + UTC timestamp (YYYYMMDD-HHmmss) |
| \`timestamp\`     | \`20260217-103000.jpg\`                               | UTC timestamp only                              |

The naming strategy is applied during \`uploadFile\` and \`duplicateFile\`. The original filename is always preserved in metadata regardless of the strategy used. Per-slug \`fileNaming\` overrides the global setting.

## FileManager API

All methods are on the object returned by \`createFileManager()\`.

### uploadFile(slug, file, options?) \u2192 Promise<UploadResult>
Upload a file to a slug's storage directory. Supports an \`onProgress\` callback for tracking server-side processing phases.
\`\`\`typescript
const result = await fm.uploadFile("images", {
  buffer: fileBuffer,
  originalName: "photo.jpg",
  mimeType: "image/jpeg",
  size: fileBuffer.length,
}, {
  fileName: "custom-name.jpg",  // optional rename
  subPath: "avatars",           // optional subdirectory within slug
  overwrite: false,             // optional, default false
  onProgress: (event) => {      // optional progress callback
    console.log(\`\${event.phase}: \${event.percent}% \u2014 \${event.message}\`);
  },
});
// result: { success, filePath, fileName, slug, size, mimeType, createdAt, variants? }
\`\`\`

Progress phases and approximate percentages (adjusted dynamically based on slug config):
- \`validating\` \u2014 10% \u2014 Validates MIME type and file size
- \`writing\` \u2014 40\u201380% \u2014 Writes file to disk (higher when zip/compression not active)
- \`zipping\` \u2014 60% \u2014 Creates zip archive (only if zip enabled)
- \`compressing\` \u2014 80% \u2014 Compresses image via sharp (only if compression enabled)
- \`saving-metadata\` \u2014 90\u201395% \u2014 Saves metadata index
- \`complete\` \u2014 100% \u2014 Upload finished

### downloadFile(identifier, options?) \u2192 Promise<DownloadResult>
Download a file by identifier.
\`\`\`typescript
const result = await fm.downloadFile({ slug: "images", name: "photo.jpg" }, {
  variant: "compressed", // "original" | "compressed" | "zip"
});
// result: { buffer, fileName, mimeType, size }
\`\`\`

### getFileInfo(identifier) \u2192 Promise<FileInfo>
Get metadata and details about a file.
\`\`\`typescript
const info = await fm.getFileInfo({ slug: "images", name: "photo.jpg" });
// info: { name, path, size, mimeType, createdAt, updatedAt, versions?, variants?, retentionExpiresAt? }
\`\`\`

### listFiles(identifier) \u2192 Promise<FileListItem[]>
List all files in a slug or subfolder.
\`\`\`typescript
const files = await fm.listFiles({ slug: "images", subPath: "avatars" });
// files: [{ name, path, size, mimeType, createdAt }, ...]
\`\`\`

### listFolders(identifier) \u2192 Promise<FolderListItem[]>
List subfolders within a slug.
\`\`\`typescript
const folders = await fm.listFolders({ slug: "images" });
// folders: [{ name, path }, ...]
\`\`\`

### deleteFile(identifier, options?) \u2192 Promise<OperationResult>
Delete a file and optionally its versions/variants.
\`\`\`typescript
await fm.deleteFile({ slug: "images", name: "photo.jpg" }, {
  deleteAllVersions: true,
  deleteVariants: true,
});
\`\`\`

### updateFile(identifier, newFile, options?) \u2192 Promise<UploadResult>
Replace a file. Creates a version if versioning is enabled.
\`\`\`typescript
const result = await fm.updateFile(
  { slug: "images", name: "photo.jpg" },
  newFileInput,
  { createVersion: true },
);
\`\`\`

### renameFile(identifier, newName, options?) \u2192 Promise<OperationResult>
Rename a file.
\`\`\`typescript
await fm.renameFile({ slug: "images", name: "photo.jpg" }, "avatar.jpg", {
  renameVersions: true,
  renameVariants: true,
});
\`\`\`

### moveFile(identifier, target, options?) \u2192 Promise<OperationResult>
Move a file to a different slug or subfolder.
\`\`\`typescript
await fm.moveFile(
  { slug: "images", name: "photo.jpg" },
  { slug: "documents", subPath: "archive" },
  { moveVersions: true, moveVariants: true, overwrite: false },
);
\`\`\`

### duplicateFile(identifier, target?, options?) \u2192 Promise<OperationResult>
Copy a file, optionally to a different location.
\`\`\`typescript
await fm.duplicateFile(
  { slug: "images", name: "photo.jpg" },
  { slug: "images" },
  { newName: "photo-copy.jpg", duplicateVariants: false },
);
\`\`\`

### listVersions(identifier) \u2192 Promise<VersionInfo[]>
List all versions of a file (requires versioning enabled).
\`\`\`typescript
const versions = await fm.listVersions({ slug: "images", name: "photo.jpg" });
// versions: [{ versionId, path, createdAt, size }, ...]
\`\`\`

### restoreVersion(identifier, versionId) \u2192 Promise<OperationResult>
Restore a previous version of a file.
\`\`\`typescript
await fm.restoreVersion({ slug: "images", name: "photo.jpg" }, "v_1234567890");
\`\`\`

### byteaPack(slug, file, options?) \u2192 Promise<ByteaPackResult>
Package a file into a compressed, ZIP-based binary buffer for direct PostgreSQL \`bytea\` storage. Validates MIME type and size against slug config. Accepts \`FileInput\` or \`ByteaPackInput\`.
\`\`\`typescript
const packed = await fm.byteaPack("documents", {
  buffer: fileBuffer,
  originalName: "report.pdf",
  mimeType: "application/pdf",
  size: fileBuffer.length,
});
// packed: { buffer, manifest, packedSize, originalSize }
await sql\`INSERT INTO files (data) VALUES (\${packed.buffer})\`;
\`\`\`

### byteaUnpack(packed) \u2192 Promise<ByteaUnpackResult>
Unpack a bytea-packed buffer back into the original file and its manifest.
\`\`\`typescript
const { buffer, manifest } = await fm.byteaUnpack(packedBuffer);
// buffer: original file content
// manifest: { version, slug?, filename, mimeType, originalSize, createdAt, packedAt, custom? }
\`\`\`

## Bytea Pack \u2014 Standalone API

Standalone functions that work without a \`FileManager\` instance:

\`\`\`typescript
import { byteaPack, byteaUnpack } from "manas-fm";
import type { ByteaPackInput, ByteaPackOptions, ByteaPackResult, ByteaManifest, ByteaUnpackResult } from "manas-fm";
\`\`\`

### byteaPack(input, options?, slug?) \u2192 Promise<ByteaPackResult>
Pack a file into a ZIP-based binary buffer. Source can be a \`Buffer\`, file path (\`string\`), or \`Readable\` stream.
\`\`\`typescript
const packed = await byteaPack({
  source: fileBuffer,        // Buffer | string (path) | Readable
  filename: "report.pdf",
  mimeType: "application/pdf",
  custom: { userId: 42 },    // optional metadata
}, {
  compressionLevel: 9,       // 0\u20139 (default: 9)
  custom: { extra: "data" }, // merged with input.custom
});
\`\`\`

### byteaUnpack(packed) \u2192 Promise<ByteaUnpackResult>
Extract the original file and manifest from a bytea pack buffer.
\`\`\`typescript
const { buffer, manifest } = await byteaUnpack(packedBuffer);
\`\`\`

### ByteaManifest
\`\`\`typescript
interface ByteaManifest {
  version: 1;                // format version
  slug?: string;             // populated when packed via FileManager
  filename: string;
  mimeType: string;
  originalSize: number;
  createdAt: string;         // ISO-8601
  packedAt: string;          // ISO-8601
  custom?: Record<string, unknown>;
}
\`\`\`

The pack is a standard ZIP containing \`manifest.json\` and \`payload/<filename>\`. No base64 encoding \u2014 raw binary for optimal \`bytea\` performance.

## Next.js Integration

### 1. Create a singleton file manager

\`\`\`typescript
// lib/file-manager.ts
import { createFileManager } from "manas-fm";
import type { FileManager, ManasFmConfig } from "manas-fm";
import path from "node:path";

const config: ManasFmConfig = {
  basePath: path.join(process.cwd(), "storage"),
  versioning: { enabledByDefault: true, maxVersions: 5 },
  slugs: {
    images: {
      path: "images",
      allowedTypes: ["image/jpeg", "image/png", "image/webp"],
      maxSizeBytes: 10 * 1024 * 1024,
      compression: { enabled: true, keepOriginal: true, quality: 75, format: "webp" },
    },
    documents: {
      path: "documents",
      allowedTypes: ["application/pdf", "text/plain"],
      maxSizeBytes: 25 * 1024 * 1024,
    },
  },
};

// Cache the promise globally to avoid re-initialization in dev mode (HMR)
const globalForFm = globalThis as typeof globalThis & { __manasFm?: Promise<FileManager> };

export function getFileManager(): Promise<FileManager> {
  if (!globalForFm.__manasFm) {
    globalForFm.__manasFm = createFileManager(config);
  }
  return globalForFm.__manasFm;
}
\`\`\`

### 2. Set up catch-all API route

\`\`\`typescript
// app/api/files/[...all]/route.ts
import { toNextJsHandler } from "manas-fm";
import { getFileManager } from "@/lib/file-manager";

const handler = toNextJsHandler(getFileManager());

export const GET = handler.GET;
export const POST = handler.POST;
\`\`\`

\`toNextJsHandler\` accepts a \`FileManager\` or \`Promise<FileManager>\` and returns \`{ GET, POST }\` handlers.

**GET endpoints** (determined by last URL segment):
- \`/api/files/download?slug=images&name=photo.jpg&variant=original\`
- \`/api/files/list?slug=images&subPath=avatars&type=files\` (type: "files" | "folders")
- \`/api/files/info?slug=images&name=photo.jpg\`
- \`/api/files/versions?slug=images&name=photo.jpg\`

**POST endpoints** (determined by last URL segment):
- \`/api/files/upload\` \u2014 FormData: \`file\`, \`slug\`, \`subPath?\`, \`overwrite?\`
- \`/api/files/update\` \u2014 FormData: \`file\`, \`slug\`, \`name\`, \`createVersion?\`
- \`/api/files/delete\` \u2014 JSON: \`{ slug, name, deleteAllVersions?, deleteVariants? }\`
- \`/api/files/rename\` \u2014 JSON: \`{ slug, name, newName, renameVersions?, renameVariants? }\`
- \`/api/files/move\` \u2014 JSON: \`{ slug, name, targetSlug, targetSubPath?, moveVersions?, moveVariants? }\`
- \`/api/files/duplicate\` \u2014 JSON: \`{ slug, name, targetSlug?, newName?, duplicateVariants? }\`
- \`/api/files/restore\` \u2014 JSON: \`{ slug, name, versionId }\`

#### Streaming Upload Progress

The \`/api/files/upload\` endpoint supports real-time progress streaming. Send the request with
\`Accept: text/event-stream\` to receive NDJSON (newline-delimited JSON) progress events instead of
a single JSON response. Without this header, the endpoint returns a standard JSON response (backwards compatible).

**NDJSON events:**
\`\`\`
{"type":"progress","phase":"validating","percent":10,"message":"Validating file..."}
{"type":"progress","phase":"writing","percent":40,"message":"Writing file to disk..."}
{"type":"progress","phase":"compressing","percent":80,"message":"Compressing image..."}
{"type":"progress","phase":"saving-metadata","percent":95,"message":"Saving metadata..."}
{"type":"progress","phase":"complete","percent":100,"message":"Upload complete"}
{"type":"result","data":{"success":true,"filePath":"...","fileName":"...","slug":"images",...}}
\`\`\`

On error: \`{"type":"error","error":"message","status":400}\`

**Client-side usage with XHR (for upload + processing progress):**
\`\`\`typescript
const xhr = new XMLHttpRequest();
xhr.upload.onprogress = (e) => { /* network transfer progress (bytes sent) */ };
xhr.onprogress = () => { /* parse xhr.responseText for NDJSON server progress */ };
xhr.open("POST", "/api/files/upload");
xhr.setRequestHeader("Accept", "text/event-stream");
xhr.send(formData);
\`\`\`

### 3. Use in Server Actions

\`\`\`typescript
// app/actions.ts
"use server";
import { getFileManager } from "@/lib/file-manager";

export async function uploadFile(formData: FormData) {
  const fm = await getFileManager();
  const file = formData.get("file") as File;
  const buffer = Buffer.from(await file.arrayBuffer());

  return await fm.uploadFile("images", {
    buffer,
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
  });
}

export async function listFiles(slug: string) {
  const fm = await getFileManager();
  return await fm.listFiles({ slug });
}

export async function deleteFile(slug: string, name: string) {
  const fm = await getFileManager();
  return await fm.deleteFile({ slug, name });
}
\`\`\`

## Error Handling

All errors extend \`ManasFmError\`. Import from the package root:

\`\`\`typescript
import {
  ManasFmError,       // Base error class
  ConfigError,        // Invalid configuration
  ValidationError,    // Invalid input (bad MIME type, size exceeded, etc.)
  FileNotFoundError,  // File does not exist
  PermissionError,    // Filesystem permission denied
  StorageError,       // Disk/storage failure
  OperationError,     // Operation conflict (e.g., file already exists)
} from "manas-fm";
\`\`\`

The Next.js adapter automatically maps errors to HTTP status codes:
- \`ValidationError\` \u2192 400
- \`PermissionError\` \u2192 403
- \`FileNotFoundError\` \u2192 404
- \`OperationError\` \u2192 409
- Other \`ManasFmError\` \u2192 500

## Exports

Main entry point: \`manas-fm\`
- \`createFileManager\` \u2014 factory function
- All types: \`ManasFmConfig\`, \`SlugConfig\`, \`FileManager\`, \`FileInput\`, \`UploadResult\`, \`UploadPhase\`, \`UploadProgressEvent\`, \`DownloadResult\`, \`FileInfo\`, \`FileListItem\`, \`FolderListItem\`, \`VersionInfo\`, \`OperationResult\`, \`FileNamingStrategy\`, \`GlobalFileNamingConfig\`, \`SlugFileNamingConfig\`, etc.
- All errors: \`ManasFmError\`, \`ConfigError\`, \`ValidationError\`, \`FileNotFoundError\`, \`PermissionError\`, \`StorageError\`, \`OperationError\`
- \`toNextJsHandler\` \u2014 Next.js adapter
- Bytea Pack: \`byteaPack\`, \`byteaUnpack\`, \`BYTEA_PACK_VERSION\`
- Bytea types: \`ByteaPackSource\`, \`ByteaPackInput\`, \`ByteaPackOptions\`, \`ByteaPackResult\`, \`ByteaManifest\`, \`ByteaUnpackResult\`

## Key Concepts

1. **Slugs** are named storage categories defined in config. Each slug maps to a subdirectory under \`basePath\` and carries its own rules (allowed types, max size, versioning, compression, retention).
2. **FileIdentifier** \`{ slug, name }\` is the primary way to reference files in operations.
3. **FolderIdentifier** \`{ slug, subPath? }\` references directories within a slug.
4. **Versioning** stores previous file versions automatically on update. Controlled globally and per-slug.
5. **Compression** uses Sharp to create optimized variants (JPEG, WebP, PNG). Original can be kept alongside compressed version.
6. **Retention** automatically expires files after \`retentionDays\` when cleanup is enabled.
7. **\`createFileManager\` is async** \u2014 it validates config and creates directories before returning.
8. **The Next.js adapter** (\`toNextJsHandler\`) creates GET/POST route handlers from a FileManager instance, routing by URL segment.
9. **File naming strategies** control how uploaded files are named on disk. Set globally via \`fileNaming: { strategy }\` or per-slug. The \`original\` strategy (default) preserves the uploaded filename. Other strategies (\`uuid\`, \`name-uuid\`, \`name-number\`, \`name-timestamp\`, \`timestamp\`) generate names automatically. The original filename is always stored in metadata.
10. **Bytea Pack** allows packaging files into compressed ZIP-based binary buffers for direct PostgreSQL \`bytea\` storage. Available as standalone \`byteaPack()\`/\`byteaUnpack()\` utilities or as \`fm.byteaPack()\`/\`fm.byteaUnpack()\` FileManager methods with slug validation. Each pack contains a manifest (metadata) and the original file payload.
`;
}
