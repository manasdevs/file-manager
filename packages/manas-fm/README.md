# manas-fm

A powerful, configuration-first file management package for Node.js and Next.js applications. Handle file uploads, downloads, versioning, compression, and more with a simple, type-safe API.

[![npm version](https://img.shields.io/npm/v/manas-fm.svg)](https://www.npmjs.com/package/manas-fm)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/manasdevs/file-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/manasdevs/file-manager/actions/workflows/ci.yml)

## Features

- **Configuration-First**: Define your file storage strategy once, use everywhere
- **Type-Safe**: Full TypeScript support with comprehensive type definitions
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

## Quick Start

### Basic Usage

```typescript
import { createFileManager } from 'manas-fm';

const fm = createFileManager({
  basePath: './storage',
  slugCount: 3,
  enableVersioning: true,
  enableCompression: true,
});

// Upload a file
const result = await fm.upload({
  file: fileBuffer,
  filename: 'profile.jpg',
  path: 'users/avatars',
});

console.log(result.url); // users/avatars/abc/profile.jpg
```

### Next.js Integration

#### 1. Create File Manager Instance

```typescript
// lib/file-manager.ts
import { createFileManager } from 'manas-fm';
import path from 'path';

export const fm = createFileManager({
  basePath: path.join(process.cwd(), 'storage'),
  slugCount: 3,
  enableVersioning: true,
  enableCompression: true,
  maxVersions: 5,
});
```

#### 2. Set Up API Route

```typescript
// app/api/files/[...all]/route.ts
import { toNextJsHandler } from 'manas-fm/adapters/nextjs';
import { fm } from '@/lib/file-manager';

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
'use server';

import { fm } from '@/lib/file-manager';

export async function uploadFile(formData: FormData) {
  const file = formData.get('file') as File;
  const buffer = Buffer.from(await file.arrayBuffer());

  return await fm.upload({
    file: buffer,
    filename: file.name,
    path: 'uploads',
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
}
```

## API Reference

### File Operations

#### `upload(options: UploadOptions): Promise<UploadResult>`

Upload a file to storage.

```typescript
const result = await fm.upload({
  file: buffer,           // Buffer or ArrayBuffer
  filename: 'photo.jpg',
  path: 'users/123',      // Optional subfolder
  metadata: {             // Optional custom metadata
    uploadedBy: 'user123',
    tags: ['profile', 'avatar'],
  },
});
```

#### `download(filePath: string): Promise<DownloadResult>`

Download a file and its metadata.

```typescript
const result = await fm.download('users/123/abc/photo.jpg');
```

#### `delete(filePath: string): Promise<DeleteResult>`

Delete a file and all its versions.

```typescript
await fm.delete('users/123/abc/photo.jpg');
```

#### `rename(options: RenameOptions): Promise<RenameResult>`

Rename a file.

```typescript
await fm.rename({
  oldPath: 'users/123/abc/photo.jpg',
  newFilename: 'avatar.jpg',
});
```

#### `move(options: MoveOptions): Promise<MoveResult>`

Move a file to a different folder.

```typescript
await fm.move({
  sourcePath: 'users/123/abc/photo.jpg',
  destinationFolder: 'users/456',
});
```

#### `duplicate(options: DuplicateOptions): Promise<DuplicateResult>`

Create a copy of a file.

```typescript
await fm.duplicate({
  sourcePath: 'users/123/abc/photo.jpg',
  newFilename: 'photo-copy.jpg', // Optional
});
```

#### `update(options: UpdateOptions): Promise<UpdateResult>`

Update a file (creates new version if versioning is enabled).

```typescript
await fm.update({
  filePath: 'users/123/abc/photo.jpg',
  newFile: newBuffer,
});
```

#### `getFileInfo(filePath: string): Promise<FileInfo>`

Get detailed information about a file.

```typescript
const info = await fm.getFileInfo('users/123/abc/photo.jpg');
console.log(info.size, info.mimeType, info.metadata);
```

### Folder Operations

#### `listFiles(folderPath?: string): Promise<ListFilesResult>`

List all files in a folder.

```typescript
const result = await fm.listFiles('users/123');
```

#### `listFolders(folderPath?: string): Promise<ListFoldersResult>`

List all subfolders in a folder.

```typescript
const result = await fm.listFolders('users');
```

### Versioning Operations

#### `getVersions(filePath: string): Promise<VersionsResult>`

Get all versions of a file.

```typescript
const versions = await fm.getVersions('users/123/abc/photo.jpg');
```

#### `restoreVersion(options: RestoreVersionOptions): Promise<RestoreResult>`

Restore a previous version of a file.

```typescript
await fm.restoreVersion({
  filePath: 'users/123/abc/photo.jpg',
  versionTimestamp: 1234567890,
});
```

### Archive Operations

#### `zipFiles(options: ZipOptions): Promise<ZipResult>`

Create a ZIP archive from files.

```typescript
const zipResult = await fm.zipFiles({
  files: ['file1.jpg', 'file2.pdf'],
  zipName: 'archive.zip',
  outputPath: 'downloads',
});
```

#### `zipFolder(options: ZipFolderOptions): Promise<ZipResult>`

Create a ZIP archive from an entire folder.

```typescript
const zipResult = await fm.zipFolder({
  folderPath: 'users/123',
  zipName: 'user-files.zip',
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
} from 'manas-fm/errors';

try {
  await fm.upload({ file: buffer, filename: 'test.jpg' });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed:', error.message);
  } else if (error instanceof FileNotFoundError) {
    console.error('File not found:', error.message);
  } else if (error instanceof PermissionError) {
    console.error('Permission denied:', error.message);
  } else if (error instanceof StorageError) {
    console.error('Storage error:', error.message);
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
} from 'manas-fm';
```

## Best Practices

1. **Use Absolute Paths**: Always use absolute paths for `basePath` configuration
   ```typescript
   import path from 'path';

   const fm = createFileManager({
     basePath: path.join(process.cwd(), 'storage'),
   });
   ```

2. **Enable Versioning for Critical Files**: Enable versioning for files that need history tracking
   ```typescript
   const fm = createFileManager({
     basePath: './storage',
     enableVersioning: true,
     maxVersions: 10,
   });
   ```

3. **Compress Images**: Enable compression for image-heavy applications
   ```typescript
   const fm = createFileManager({
     basePath: './storage',
     enableCompression: true,
     compressionQuality: 85,
   });
   ```

4. **Validate File Types**: Use `allowedExtensions` to restrict file types
   ```typescript
   const fm = createFileManager({
     basePath: './storage',
     allowedExtensions: ['.jpg', '.jpeg', '.png', '.pdf'],
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
