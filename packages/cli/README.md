# add-manas-fm

A beautiful, interactive CLI tool to quickly set up [manas-fm](https://github.com/manasdevs/file-manager) file management in your Next.js or Node.js projects.

[![npm version](https://img.shields.io/npm/v/add-manas-fm.svg)](https://www.npmjs.com/package/add-manas-fm)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🎨 **Beautiful Interface** - Enhanced with ansi-styles for a premium terminal experience
- 🔍 **Auto-Detection** - Automatically detects your project type, framework, and configuration
- ⚙️ **Interactive Setup** - Guided prompts for easy configuration
- ☁️ **Cloud Storage** - Choose from 12+ cloud providers (AWS S3, GCS, Azure, DigitalOcean, Backblaze, Wasabi, Cloudflare R2, MinIO, Oracle, IBM, Supabase, Firebase) or local filesystem
- 📦 **Complete Integration** - Generates all necessary files and configurations
- 🎯 **Framework Support** - Optimized for Next.js App Router with API routes and Server Actions
- 📊 **Upload Progress** - Optional `useUploadProgress()` hook with network + server-side progress tracking
- �️ **Bytea Pack** - Package files into compressed binary format for PostgreSQL `bytea` storage
- �🚀 **Zero Config** - Works out of the box with sensible defaults
- 📁 **Smart Structure** - Creates organized storage directories with .gitkeep files
- 📖 **LLM Documentation** - Generates `docs/llms/manas-fm.llms.txt` for AI-assisted development
- 🔧 **Package Manager Agnostic** - Supports npm, yarn, and pnpm

## Quick Start

Run the CLI in your project directory:

```bash
npx add-manas-fm@latest
```

That's it! The CLI will guide you through the setup process with beautiful, interactive prompts.

## Installation

No installation required! Use `npx` to run the latest version directly:

```bash
npx add-manas-fm@latest
```

Or install globally:

```bash
npm install -g add-manas-fm
# Then run
add-manas-fm
```

## Commands

### `init` (default)

Runs the interactive setup wizard:

```bash
npx add-manas-fm@latest init
# or simply
npx add-manas-fm@latest
```

### `--help` / `-h`

Display help information:

```bash
npx add-manas-fm@latest --help
```

### `--version` / `-v`

Show the CLI version:

```bash
npx add-manas-fm@latest --version
```

## What It Does

The CLI automates the entire setup process:

### 1. 📦 Project Detection

- Detects Next.js vs Node.js projects
- Identifies TypeScript/JavaScript
- Finds `src/` directory structure
- Detects App Router vs Pages Router
- Identifies package manager (npm/yarn/pnpm)

### 2. ⚙️ Configuration

Guides you through interactive prompts:

- **Storage Path**: Where to store files (default: `./storage`)
- **Storage Provider**: Choose between local filesystem or cloud providers:
  - **Local** (default) - Store files on the local filesystem
  - **AWS S3** - Amazon Simple Storage Service
  - **Google Cloud Storage** - S3-compatible via GCS interoperability
  - **Azure Blob Storage** - Microsoft Azure
  - **DigitalOcean Spaces** - S3-compatible object storage
  - **Backblaze B2** - Affordable cloud storage
  - **Wasabi** - Hot cloud storage
  - **Cloudflare R2** - Zero egress-fee storage
  - **MinIO** - Self-hosted S3-compatible storage
  - **Oracle Cloud** - Oracle Cloud Object Storage
  - **IBM Cloud** - IBM Cloud Object Storage
  - **Supabase** - S3-compatible storage layer
  - **Firebase** - Firebase Cloud Storage
- **Cloud Credentials**: Provider-specific prompts for bucket, region, connection strings, etc.
- **Logging**: Enable/disable with configurable log levels
- **Slugs**: Define file categories with preset options:
  - Images (JPEG, PNG, WebP, GIF)
  - Documents (PDF, DOCX, TXT, JSON)
  - Uploads (generic files)
  - Avatars (profile images)
  - Videos (MP4, WebM, MOV)
- **Compression**: Configure image compression settings
- **File Types**: Specify allowed MIME types
- **Size Limits**: Set max file sizes per category
- **Retention**: Configure auto-cleanup policies

### 3. 📥 Installation

Automatically installs `manas-fm` using your project's package manager. For cloud providers, also installs the required SDK:

- S3-compatible: `@aws-sdk/client-s3` + `@aws-sdk/lib-storage`
- Azure: `@azure/storage-blob`
- Firebase: `firebase-admin`

### 4. 📁 Storage Setup

- **Local**: Creates storage directory structure, generates subdirectories for each slug, adds `.gitkeep` files
- **Cloud**: Generates a `.env.example` with placeholder credentials for your chosen provider

### 5. 🔧 Code Generation

#### For Next.js Projects:

**File Manager Configuration:**

```typescript
// src/lib/file-manager.ts
import { createNextFileManager } from "manas-fm/adapters/nextjs";

export async function getFileManager() {
  return createNextFileManager({
    basePath: "./storage",
    enableLogging: true,
    logLevel: "info",
    slugs: [
      {
        name: "images",
        path: "images",
        allowedTypes: ["image/jpeg", "image/png", "image/webp"],
        maxSizeMB: 10,
        enableCompression: true,
      },
      // ... more slugs
    ],
  });
}
```

**API Route Handler** (optional):

```typescript
// src/app/api/files/[...all]/route.ts
import { getFileManager } from "@/lib/file-manager";

export async function GET(request: Request) {
  const fm = await getFileManager();
  return fm.handleRequest(request);
}

export async function POST(request: Request) {
  const fm = await getFileManager();
  return fm.handleRequest(request);
}
// ... DELETE, PUT, PATCH
```

**Server Actions** (optional):

```typescript
// src/app/actions.ts
"use server";

import { getFileManager } from "@/lib/file-manager";

export async function uploadFile(formData: FormData) {
  const fm = await getFileManager();
  return fm.upload({
    file: formData.get("file"),
    slug: formData.get("slug"),
  });
}
// ... more actions
```

**Upload Progress Hook** (optional):

```typescript
// src/app/use-upload-progress.ts
import { useUploadProgress } from "./use-upload-progress";

function UploadForm() {
  const { upload, percent, phase, phaseLabel, isUploading, error, result } = useUploadProgress();

  const handleUpload = (file: File) => {
    upload(file, "images", { overwrite: false });
  };

  return (
    <div>
      {isUploading && (
        <div>
          <progress value={percent} max={100} />
          <span>{phaseLabel} ({percent}%)</span>
        </div>
      )}
    </div>
  );
}
```

The hook tracks progress at two levels:

- **Network transfer (0–50%)**: Tracks bytes sent via XMLHttpRequest
- **Server processing (50–100%)**: Reads streaming NDJSON progress from the API route (validating → writing → compressing → complete)

#### For Node.js Projects:

Generates a basic file manager configuration without framework-specific code.

### 6. 📝 .gitignore Update

Automatically adds your storage directory to `.gitignore` while preserving the structure:

```gitignore
# manas-fm storage
storage/
!storage/.gitkeep
```

## Example CLI Output

```
  ╭─────────────────────────────────────────╮
  │  ✨ manas-fm File Manager Setup         │
  ╰─────────────────────────────────────────╯

  ━━━ 📦 Project Detection ━━━

  ▸ Detecting project...
  ℹ  Package manager: pnpm
  ℹ  Detected: Next.js project
  ℹ  TypeScript: ✓
  ℹ  src/ directory: ✓
  ℹ  App Router: ✓

  ━━━ ⚙️  Configuration ━━━

  ? Where should files be stored? ./storage
  ? Enable logging? yes
  ? Log level: › info
  ? Set up slugs (file categories)? yes
  ? Use preset configurations? yes
  ? Select presets: ❯ images, documents, uploads
  ? Generate API route handler? yes
  ? Generate Server Actions? yes
  ? Generate upload progress hook? yes

  ━━━ 📥 Installation ━━━

  ▸ Installing manas-fm...
  ✓ Installed manas-fm

  ━━━ 📁 Storage Setup ━━━

  ▸ Creating storage directory...
  ✓ Storage directory: ./storage
  ✓ Created: storage/images
  ✓ Created: storage/documents
  ✓ Created: storage/uploads

  ━━━ 🔧 Code Generation ━━━

  ▸ Generating file manager configuration...
  ✓ Created: src/lib/file-manager.ts
  ▸ Generating API route handler...
  ✓ Created: src/app/api/files/[...all]/route.ts
  ▸ Generating server actions...
  ✓ Created: src/app/actions.ts
  ▸ Generating upload progress hook...
  ✓ Created: src/app/use-upload-progress.ts
  ▸ Generating llms.txt documentation...
  ✓ Documentation: docs/llms/manas-fm.llms.txt
  ▸ Updating .gitignore...
  ✓ Updated .gitignore

  ┌────────────────────────────────────┐
  │  ✨ Setup Complete!                │
  └────────────────────────────────────┘

  🚀 Next Steps
  ────────────────────────────────────

  1. Import and use the file manager:
     import { getFileManager } from "@/lib/file-manager";
     const fm = await getFileManager();

  2. API routes are ready at /api/files/*

  3. Server actions ready in app/actions.ts

  4. Upload progress hook ready: useUploadProgress()
     import { useUploadProgress } from "./use-upload-progress";
     const { upload, percent, phase } = useUploadProgress();

  5. Available slugs: images, documents, uploads

  6. LLM docs at docs/llms/manas-fm.llms.txt

  7. Read the docs: https://github.com/manasdevs/file-manager#readme

```

## Preset Configurations

The CLI includes preset configurations for common use cases:

### Images

- **Types**: JPEG, PNG, WebP, GIF
- **Max Size**: 10 MB
- **Compression**: Enabled (WebP, 75% quality)

### Documents

- **Types**: PDF, TXT, JSON, DOC, DOCX
- **Max Size**: 25 MB
- **Zip Support**: Enabled
- **Retention**: 90 days

### Uploads

- **Types**: All files
- **Max Size**: 50 MB

### Avatars

- **Types**: JPEG, PNG, WebP
- **Max Size**: 5 MB
- **Compression**: Enabled (WebP, 80% quality)

### Videos

- **Types**: MP4, WebM, MOV
- **Max Size**: 100 MB

## Customization

You can customize all generated files after setup. The CLI creates well-commented, readable code that's easy to modify.

## Requirements

- Node.js 18 or higher
- A Next.js or Node.js project

## Support

- [GitHub Issues](https://github.com/manasdevs/file-manager/issues)
- [Full Documentation](https://github.com/manasdevs/file-manager)
- [manas-fm Package](https://www.npmjs.com/package/manas-fm)

## License

MIT © [M Anas Latif](https://m.anaslatif.dev)

## Author

**M Anas Latif**

- Website: [https://m.anaslatif.dev](https://m.anaslatif.dev)
- Email: contact@anaslatif.com
- GitHub: [@manasdevs](https://github.com/manasdevs)
