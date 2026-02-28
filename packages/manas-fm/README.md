# manas-fm

A powerful, configuration-first file management package for Node.js and Next.js applications. Handle file uploads, downloads, versioning, compression, and more with a simple, type-safe API.

[![npm version](https://img.shields.io/npm/v/manas-fm.svg)](https://www.npmjs.com/package/manas-fm)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/manasdevs/file-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/manasdevs/file-manager/actions/workflows/ci.yml)

## Features

- **Configuration-First**: Define your file storage strategy once, use everywhere
- **Type-Safe**: Full TypeScript support with comprehensive type definitions
- **Cloud Storage**: Support for AWS S3, GCS, Azure Blob, DigitalOcean Spaces, Backblaze B2, Wasabi, Cloudflare R2, MinIO, Oracle, IBM, Supabase, and Firebase Storage
- **Next.js Integration**: Built-in adapter for seamless Next.js App Router integration
- **File Operations**: Upload, download, delete, rename, move, duplicate files
- **Versioning**: Automatic file versioning with rollback support
- **Compression**: Built-in image compression with Sharp integration
- **Metadata Management**: Store and retrieve custom metadata for files
- **Folder Operations**: Create, list, and manage folder structures
- **ZIP Support**: Create ZIP archives from files and folders
- **Cleanup Management**: Automatic cleanup of old file versions
- **Path Slugging**: Configurable slug generation for organized file storage
- **Error Handling**: Comprehensive error types for robust error handling

## Installation

```bash
npm install manas-fm
```

```bash
yarn add manas-fm
```

```bash
pnpm add manas-fm
```

### Optional Dependencies

For image compression support, install Sharp:

```bash
npm install sharp
```

For cloud storage, install the SDK for your provider:

```bash
# AWS S3, GCS, DigitalOcean Spaces, Backblaze B2, Wasabi, MinIO, Cloudflare R2, etc.
npm install @aws-sdk/client-s3 @aws-sdk/lib-storage

# Azure Blob Storage
npm install @azure/storage-blob

# Firebase Storage
npm install firebase-admin
```

## Quick Start

### Basic Usage

```typescript
import { createFileManager } from "manas-fm";

const fm = createFileManager({
  basePath: "./storage",
  slugCount: 3,
  enableVersioning: true,
  enableCompression: true,
});

// Upload a file
const result = await fm.upload({
  file: fileBuffer,
  filename: "profile.jpg",
  path: "users/avatars",
});

console.log(result.url); // users/avatars/abc/profile.jpg
```

### Next.js Integration

#### 1. Create File Manager Instance

```typescript
// lib/file-manager.ts
import { createFileManager } from "manas-fm";
import path from "path";

export const fm = createFileManager({
  basePath: path.join(process.cwd(), "storage"),
  slugCount: 3,
  enableVersioning: true,
  enableCompression: true,
  maxVersions: 5,
});
```

#### 2. Set Up API Route

```typescript
// app/api/files/[...all]/route.ts
import { toNextJsHandler } from "manas-fm/adapters/nextjs";
import { fm } from "@/lib/file-manager";

const handler = toNextJsHandler(fm);

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
export const PUT = handler;
export const PATCH = handler;
```

#### 3. Create Server Actions

```typescript
// app/actions.ts
"use server";

import { fm } from "@/lib/file-manager";

export async function uploadFile(formData: FormData) {
  const file = formData.get("file") as File;
  const buffer = Buffer.from(await file.arrayBuffer());

  return await fm.upload({
    file: buffer,
    filename: file.name,
    path: "uploads",
  });
}

export async function listFiles(folderPath?: string) {
  return await fm.listFiles(folderPath);
}

export async function deleteFile(filePath: string) {
  return await fm.delete(filePath);
}
```

#### 4. Use in Components

```typescript
// app/page.tsx
'use client';

import { uploadFile, listFiles } from './actions';

export default function UploadPage() {
  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const result = await uploadFile(formData);
    console.log('Uploaded:', result);
  };

  return (
    <form onSubmit={handleUpload}>
      <input type="file" name="file" />
      <button type="submit">Upload</button>
    </form>
  );
}
```

## Configuration

### FileManagerConfig

```typescript
interface FileManagerConfig {
  /** Base directory for file storage (absolute path recommended) */
  basePath: string;

  /** Number of slug subdirectories (0-5, default: 2) */
  slugCount?: number;

  /** Enable automatic file versioning (default: false) */
  enableVersioning?: boolean;

  /** Enable image compression with Sharp (default: false) */
  enableCompression?: boolean;

  /** Maximum number of versions to keep (default: 5) */
  maxVersions?: number;

  /** Compression quality (0-100, default: 80) */
  compressionQuality?: number;

  /** Enable detailed logging (default: true) */
  enableLogging?: boolean;

  /** Maximum file size in bytes (default: 100MB) */
  maxFileSize?: number;

  /** Allowed file extensions (default: all allowed) */
  allowedExtensions?: string[];

  /** Cloud storage configuration (optional, defaults to local) */
  storage?: StorageConfig;
}
```

### Cloud Storage Configuration

manas-fm supports multiple cloud storage providers through a unified `StorageAdapter` interface. Local filesystem is the default — add a `storage` block to use cloud storage instead.

#### AWS S3

```typescript
const fm = await createFileManager({
  basePath: "uploads",
  storage: {
    provider: "s3",
    s3Provider: "aws",
    bucket: "my-bucket",
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  },
});
```

#### Google Cloud Storage (S3-compatible)

```typescript
const fm = await createFileManager({
  basePath: "uploads",
  storage: {
    provider: "s3",
    s3Provider: "gcs",
    bucket: "my-gcs-bucket",
    region: "us-central1",
    credentials: {
      accessKeyId: process.env.GCS_ACCESS_KEY!,
      secretAccessKey: process.env.GCS_SECRET_KEY!,
    },
  },
});
```

#### DigitalOcean Spaces

```typescript
const fm = await createFileManager({
  basePath: "uploads",
  storage: {
    provider: "s3",
    s3Provider: "digitalocean-spaces",
    bucket: "my-space",
    region: "nyc3",
    credentials: {
      accessKeyId: process.env.DO_SPACES_KEY!,
      secretAccessKey: process.env.DO_SPACES_SECRET!,
    },
  },
});
```

#### Backblaze B2

```typescript
const fm = await createFileManager({
  basePath: "uploads",
  storage: {
    provider: "s3",
    s3Provider: "backblaze",
    bucket: "my-b2-bucket",
    region: "us-west-004",
    credentials: {
      accessKeyId: process.env.B2_KEY_ID!,
      secretAccessKey: process.env.B2_APP_KEY!,
    },
  },
});
```

#### Wasabi

```typescript
const fm = await createFileManager({
  basePath: "uploads",
  storage: {
    provider: "s3",
    s3Provider: "wasabi",
    bucket: "my-wasabi-bucket",
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.WASABI_KEY!,
      secretAccessKey: process.env.WASABI_SECRET!,
    },
  },
});
```

#### Cloudflare R2

```typescript
const fm = await createFileManager({
  basePath: "uploads",
  storage: {
    provider: "s3",
    s3Provider: "cloudflare",
    bucket: "my-r2-bucket",
    region: "auto",
    credentials: {
      accessKeyId: process.env.CF_R2_KEY!,
      secretAccessKey: process.env.CF_R2_SECRET!,
    },
  },
});
```

#### MinIO (Self-hosted)

```typescript
const fm = await createFileManager({
  basePath: "uploads",
  storage: {
    provider: "s3",
    s3Provider: "minio",
    bucket: "my-bucket",
    region: "us-east-1",
    endpoint: "http://localhost:9000",
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY!,
      secretAccessKey: process.env.MINIO_SECRET_KEY!,
    },
  },
});
```

#### Azure Blob Storage

```typescript
const fm = await createFileManager({
  basePath: "uploads",
  storage: {
    provider: "azure",
    container: "my-container",
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
  },
});
```

#### Firebase Storage

```typescript
import { initializeApp, cert } from "firebase-admin/app";

// Initialize firebase-admin first
initializeApp({ credential: cert("./service-account.json") });

const fm = await createFileManager({
  basePath: "uploads",
  storage: {
    provider: "firebase",
    bucket: "my-project.appspot.com",
  },
});
```

#### Supabase Storage (S3-compatible)

```typescript
const fm = await createFileManager({
  basePath: "uploads",
  storage: {
    provider: "s3",
    s3Provider: "supabase",
    bucket: "my-bucket",
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.SUPABASE_S3_KEY!,
      secretAccessKey: process.env.SUPABASE_S3_SECRET!,
    },
  },
});
```

#### Custom StorageAdapter

You can bring your own adapter by implementing the `StorageAdapter` interface:

```typescript
import type { StorageAdapter } from "manas-fm";

const myAdapter: StorageAdapter = {
  type: "custom",
  writeFile: async (key, data) => {
    /* ... */
  },
  readFile: async (key) => {
    /* ... */
  },
  deleteFile: async (key) => {
    /* ... */
  },
  copyFile: async (src, dest) => {
    /* ... */
  },
  moveFile: async (src, dest) => {
    /* ... */
  },
  fileExists: async (key) => {
    /* ... */
  },
  getFileStats: async (key) => {
    /* ... */
  },
  listFiles: async (prefix) => {
    /* ... */
  },
  listDirectories: async (prefix) => {
    /* ... */
  },
  ensureDirectory: async (key) => {
    /* ... */
  },
  createWriteStream: async (key) => {
    /* ... */
  },
  getFileUrl: async (key) => {
    /* ... */
  },
};

const fm = await createFileManager({
  basePath: "uploads",
  storage: {
    provider: "custom",
    adapter: myAdapter,
  },
});
```

#### Supported S3-Compatible Providers

| Provider             | `s3Provider`          | Endpoint Pattern                                                    |
| -------------------- | --------------------- | ------------------------------------------------------------------- |
| AWS S3               | `aws`                 | Default AWS endpoints                                               |
| Google Cloud Storage | `gcs`                 | `https://storage.googleapis.com`                                    |
| DigitalOcean Spaces  | `digitalocean-spaces` | `https://{region}.digitaloceanspaces.com`                           |
| Backblaze B2         | `backblaze`           | `https://s3.{region}.backblazeb2.com`                               |
| Wasabi               | `wasabi`              | `https://s3.{region}.wasabisys.com`                                 |
| Cloudflare R2        | `cloudflare`          | `https://{account_id}.r2.cloudflarestorage.com`                     |
| MinIO                | `minio`               | Custom (user-provided)                                              |
| Oracle Cloud         | `oracle`              | `https://{namespace}.compat.objectstorage.{region}.oraclecloud.com` |
| IBM Cloud            | `ibm`                 | `https://s3.{region}.cloud-object-storage.appdomain.cloud`          |
| Supabase             | `supabase`            | `https://{project_ref}.supabase.co/storage/v1/s3`                   |

---

## Per-Slug Storage Overrides

Each slug can use a **completely different storage backend** by adding a `storage` key directly to the slug config. Slugs without their own `storage` inherit the top-level default.

```ts
const fm = await createFileManager({
  basePath: "./storage", // local fallback root

  // Global default → local filesystem
  // storage: { provider: "local" },  ← implicit default

  slugs: {
    // Images go to AWS S3
    images: {
      path: "images",
      allowedTypes: ["image/jpeg", "image/png"],
      storage: {
        provider: "s3",
        bucket: "my-images-bucket",
        region: "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      },
    },

    // Avatars go to Backblaze B2
    avatars: {
      path: "avatars",
      storage: {
        provider: "s3",
        s3Provider: "backblaze",
        bucket: "my-avatars-bucket",
        credentials: {
          accessKeyId: process.env.B2_KEY_ID!,
          secretAccessKey: process.env.B2_APP_KEY!,
        },
      },
    },

    // Documents go to Azure Blob Storage
    documents: {
      path: "documents",
      storage: {
        provider: "azure",
        container: "documents",
        connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
      },
    },

    // Temporary uploads stay on local disk (inherits global default)
    uploads: {
      path: "uploads",
      maxSizeBytes: 50 * 1024 * 1024,
      // No `storage` key → falls back to local filesystem
    },
  },
});
```

### How it works

Under the hood, `createFileManager` instantiates a dedicated adapter for each slug that declares its own `storage`. A **`RouterStorageAdapter`** is then placed in front of all operations and transparently forwards every file I/O call to the correct backend based on the path key.

- **Single-key operations** (`readFile`, `writeFile`, `deleteFile`, …) — routed to the slug's adapter.
- **Two-key operations** (`copyFile`, `moveFile`) — if source and destination live in the same adapter, the native adapter method is called directly. If they span different adapters (e.g. moving a file from S3 to Azure), the router reads the file from the source and writes it to the destination automatically.
- **Metadata & cleanup** — each slug's `.manasfm.index.json` is stored in its own storage backend alongside the slug's files.

> **Tip:** The `RouterStorageAdapter` is exported for advanced scenarios where you need to compose adapters yourself:
>
> ```ts
> import { RouterStorageAdapter } from "manas-fm";
> ```

## API Reference

### File Operations

#### `upload(options: UploadOptions): Promise<UploadResult>`

Upload a file to storage.

```typescript
const result = await fm.upload({
  file: buffer, // Buffer or ArrayBuffer
  filename: "photo.jpg",
  path: "users/123", // Optional subfolder
  metadata: {
    // Optional custom metadata
    uploadedBy: "user123",
    tags: ["profile", "avatar"],
  },
});
```

#### `download(filePath: string): Promise<DownloadResult>`

Download a file and its metadata.

```typescript
const result = await fm.download("users/123/abc/photo.jpg");
```

#### `delete(filePath: string): Promise<DeleteResult>`

Delete a file and all its versions.

```typescript
await fm.delete("users/123/abc/photo.jpg");
```

#### `rename(options: RenameOptions): Promise<RenameResult>`

Rename a file.

```typescript
await fm.rename({
  oldPath: "users/123/abc/photo.jpg",
  newFilename: "avatar.jpg",
});
```

#### `move(options: MoveOptions): Promise<MoveResult>`

Move a file to a different folder.

```typescript
await fm.move({
  sourcePath: "users/123/abc/photo.jpg",
  destinationFolder: "users/456",
});
```

#### `duplicate(options: DuplicateOptions): Promise<DuplicateResult>`

Create a copy of a file.

```typescript
await fm.duplicate({
  sourcePath: "users/123/abc/photo.jpg",
  newFilename: "photo-copy.jpg", // Optional
});
```

#### `update(options: UpdateOptions): Promise<UpdateResult>`

Update a file (creates new version if versioning is enabled).

```typescript
await fm.update({
  filePath: "users/123/abc/photo.jpg",
  newFile: newBuffer,
});
```

#### `getFileInfo(filePath: string): Promise<FileInfo>`

Get detailed information about a file.

```typescript
const info = await fm.getFileInfo("users/123/abc/photo.jpg");
console.log(info.size, info.mimeType, info.metadata);
```

### Folder Operations

#### `listFiles(folderPath?: string): Promise<ListFilesResult>`

List all files in a folder.

```typescript
const result = await fm.listFiles("users/123");
```

#### `listFolders(folderPath?: string): Promise<ListFoldersResult>`

List all subfolders in a folder.

```typescript
const result = await fm.listFolders("users");
```

### Versioning Operations

#### `getVersions(filePath: string): Promise<VersionsResult>`

Get all versions of a file.

```typescript
const versions = await fm.getVersions("users/123/abc/photo.jpg");
```

#### `restoreVersion(options: RestoreVersionOptions): Promise<RestoreResult>`

Restore a previous version of a file.

```typescript
await fm.restoreVersion({
  filePath: "users/123/abc/photo.jpg",
  versionTimestamp: 1234567890,
});
```

### Archive Operations

#### `zipFiles(options: ZipOptions): Promise<ZipResult>`

Create a ZIP archive from files.

```typescript
const zipResult = await fm.zipFiles({
  files: ["file1.jpg", "file2.pdf"],
  zipName: "archive.zip",
  outputPath: "downloads",
});
```

#### `zipFolder(options: ZipFolderOptions): Promise<ZipResult>`

Create a ZIP archive from an entire folder.

```typescript
const zipResult = await fm.zipFolder({
  folderPath: "users/123",
  zipName: "user-files.zip",
});
```

## Error Handling

manas-fm provides comprehensive error types for robust error handling:

```typescript
import {
  FileNotFoundError,
  ValidationError,
  PermissionError,
  StorageError,
  OperationError,
} from "manas-fm/errors";

try {
  await fm.upload({ file: buffer, filename: "test.jpg" });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error("Validation failed:", error.message);
  } else if (error instanceof FileNotFoundError) {
    console.error("File not found:", error.message);
  } else if (error instanceof PermissionError) {
    console.error("Permission denied:", error.message);
  } else if (error instanceof StorageError) {
    console.error("Storage error:", error.message);
  }
}
```

## TypeScript Support

manas-fm is written in TypeScript and provides full type definitions out of the box.

```typescript
import type {
  FileManagerConfig,
  UploadOptions,
  UploadResult,
  FileInfo,
  FileMetadata,
} from "manas-fm";
```

## Best Practices

1. **Use Absolute Paths**: Always use absolute paths for `basePath` configuration

   ```typescript
   import path from "path";

   const fm = createFileManager({
     basePath: path.join(process.cwd(), "storage"),
   });
   ```

2. **Enable Versioning for Critical Files**: Enable versioning for files that need history tracking

   ```typescript
   const fm = createFileManager({
     basePath: "./storage",
     enableVersioning: true,
     maxVersions: 10,
   });
   ```

3. **Compress Images**: Enable compression for image-heavy applications

   ```typescript
   const fm = createFileManager({
     basePath: "./storage",
     enableCompression: true,
     compressionQuality: 85,
   });
   ```

4. **Validate File Types**: Use `allowedExtensions` to restrict file types

   ```typescript
   const fm = createFileManager({
     basePath: "./storage",
     allowedExtensions: [".jpg", ".jpeg", ".png", ".pdf"],
   });
   ```

5. **Handle Errors Gracefully**: Always wrap operations in try-catch blocks
   ```typescript
   try {
     const result = await fm.upload(options);
   } catch (error) {
     // Handle error appropriately
   }
   ```

## Example Application

This repository includes a complete Next.js example application in the `example/` directory demonstrating:

- File upload with drag-and-drop
- File listing with metadata display
- File operations (rename, delete, download)
- Professional UI with CSS Modules
- Error handling and loading states
- Server actions integration

To run the example:

```bash
# Clone the repository
git clone https://github.com/manasdevs/file-manager.git
cd file-manager

# Install dependencies
pnpm install

# Build the library
pnpm build

# Start the example app
pnpm example:dev
```

## Development

### Prerequisites

- Node.js 18 or higher
- pnpm (recommended) or npm/yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/manasdevs/file-manager.git
cd file-manager

# Install dependencies
pnpm install

# Build the library
pnpm build

# Run tests
pnpm test

# Run linter
pnpm lint

# Run type checking
pnpm typecheck
```

### Scripts

```bash
# Build the library
pnpm build

# Watch mode for development
pnpm dev

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Lint code
pnpm lint

# Type check
pnpm typecheck

# Start example app
pnpm example:dev

# Build example app
pnpm example:build
```

## Publishing

The package uses `prepublishOnly` hook to automatically run tests, linting, and build before publishing:

```bash
npm publish
```

This will:

1. Run ESLint
2. Run all tests
3. Build the package
4. Publish to npm

Only the `dist/`, `README.md`, and `LICENSE` files are published (configured in `package.json` `files` field and `.npmignore`).

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and add tests
4. Run tests and linting
5. Commit your changes (`git commit -m 'Add some amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

MIT © [M Anas Latif](https://m.anaslatif.dev)

## Author

**M Anas Latif**

- Website: [https://m.anaslatif.dev](https://m.anaslatif.dev)
- Email: contact@anaslatif.com
- GitHub: [@manasdevs](https://github.com/manasdevs)

## Support

If you encounter any issues or have questions:

- Open an issue: [GitHub Issues](https://github.com/manasdevs/file-manager/issues)
- Check the documentation above
- Review the [example application](./example/)
