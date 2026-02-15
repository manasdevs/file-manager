# manas-fm

A powerful, configuration-first file management package for Node.js and Next.js applications.

[![npm version](https://img.shields.io/npm/v/manas-fm.svg)](https://www.npmjs.com/package/manas-fm)
[![CI](https://github.com/manasdevs/file-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/manasdevs/file-manager/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Overview

manas-fm provides a comprehensive solution for file management in Node.js and Next.js applications with features like uploads, downloads, versioning, compression, and more.

## Repository Structure

This is a monorepo containing the library and example applications:

```
manas-fm/
├── packages/
│   ├── manas-fm/        # The core npm package
│   │   ├── src/         # Source code
│   │   ├── dist/        # Built output (generated)
│   │   ├── package.json
│   │   └── README.md    # Full package documentation
│   └── cli/             # CLI tool (add-manas-fm)
│       ├── src/         # CLI source code
│       ├── dist/        # Built output (generated)
│       ├── package.json
│       └── README.md    # CLI documentation
├── example/             # Example Next.js application
└── package.json         # Workspace root
```

## Quick Start

### Installation

```bash
npm install manas-fm
```

### Basic Usage

```typescript
import { createFileManager } from 'manas-fm';

const fm = createFileManager({
  basePath: './storage',
  enableVersioning: true,
  enableCompression: true,
});

const result = await fm.upload({
  file: buffer,
  filename: 'document.pdf',
  path: 'uploads',
});
```

## CLI Tool

manas-fm comes with a beautiful, interactive CLI tool to help you quickly set up file management in your Next.js or Node.js projects.

### ✨ Features

- 🎨 **Beautiful Interface** - Enhanced with ansi-styles for a premium terminal experience
- 🔍 **Auto-Detection** - Automatically detects your project type, framework, and configuration
- ⚙️ **Interactive Setup** - Guided prompts for easy configuration
- 📦 **Complete Integration** - Generates all necessary files and configurations
- 🎯 **Framework Support** - Optimized for Next.js App Router with API routes and Server Actions

### Quick Setup

Run the CLI in your project directory:

```bash
npx add-manas-fm@latest
```

The CLI will:
1. 📦 Detect your project framework and structure
2. ⚙️ Guide you through configuration options
3. 📥 Install the manas-fm package
4. 📁 Create storage directories with proper structure
5. 🔧 Generate the file manager configuration
6. 🚀 Set up API routes and/or Server Actions (Next.js)
7. 📝 Update your .gitignore

### CLI Commands

```bash
# Run interactive setup (default)
npx add-manas-fm@latest init

# Show help
npx add-manas-fm@latest --help

# Show version
npx add-manas-fm@latest --version
```

### What Gets Generated

#### For Next.js Projects:

- **Configuration**: `src/lib/file-manager.ts` (or `lib/file-manager.ts`)
- **API Route**: `src/app/api/files/[...all]/route.ts` (optional)
- **Server Actions**: `src/app/actions.ts` (optional)
- **Storage**: Configured directory structure based on your slugs

#### For Node.js Projects:

- **Configuration**: `lib/file-manager.js` or `.ts`
- **Storage**: Configured directory structure

### Configuration Options

During setup, you'll be asked about:

- **Storage Path**: Where to store uploaded files (default: `./storage`)
- **Logging**: Enable/disable logging and set log level
- **Slugs**: Define file categories with:
  - Custom paths
  - Allowed file types
  - Size limits
  - Compression settings
  - Retention policies
- **Next.js Specific**:
  - Generate API route handlers
  - Generate Server Actions

### Example CLI Output

```
  ╭─────────────────────────────────────────╮
  │  ✨ manas-fm File Manager Setup         │
  ╰─────────────────────────────────────────╯

  ━━━ 📦 Project Detection ━━━

  ▸ Detecting project...
  ℹ  Package manager: pnpm
  ℹ  Detected: Next.js project
  ℹ  TypeScript: ✓

  ━━━ ⚙️  Configuration ━━━

  ? Where should files be stored? ./storage
  ? Enable logging? yes
  ? Log level: info

  ━━━ 📥 Installation ━━━

  ▸ Installing manas-fm...
  ✓ Installed manas-fm

  ━━━ 📁 Storage Setup ━━━

  ▸ Creating storage directory...
  ✓ Storage directory: ./storage

  ━━━ 🔧 Code Generation ━━━

  ▸ Generating file manager configuration...

  ┌────────────────────────────────────┐
  │  ✨ Setup Complete!                │
  └────────────────────────────────────┘

  🚀 Next Steps
  ────────────────────────────────────
  
  1. Import and use the file manager:
     import { getFileManager } from "@/lib/file-manager";
     const fm = await getFileManager();
  
  2. Available slugs: images, documents, uploads
  
  3. Read the docs: https://github.com/manasdevs/file-manager#readme
```

## Documentation

For complete API documentation, configuration options, and guides, see:
- [Package Documentation](./packages/manas-fm/README.md) - Full API reference and usage guide
- [Example Application](./example/) - Complete Next.js implementation

## Development

### Prerequisites

- Node.js 18 or higher
- pnpm 8 or higher (recommended)

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
```

### Available Scripts

From the root directory:

```bash
# Build the library
pnpm build

# Watch mode for development
pnpm dev

# Run tests
pnpm test

# Run linter
pnpm lint

# Type checking
pnpm typecheck

# Start example app in development
pnpm example:dev

# Build example app
pnpm example:build
```

### Running the Example Application

```bash
# Build the library first
pnpm build

# Start the example app
pnpm example:dev
```

Open http://localhost:3000 to see the example application with:
- File upload with drag-and-drop
- File management operations
- Professional UI
- Error handling

## CI/CD & Publishing

### Automated Publishing (Recommended)

This repository uses GitHub Actions to automatically publish to npm when you create a release:

1. **Setup npm Token** (one-time):
   ```bash
   npm token create --type=automation
   ```
   Add the token as `NPM_TOKEN` in GitHub repository secrets.

2. **Create a Release**:
   - Go to GitHub → Releases → Create a new release
   - Tag version (e.g., `v1.0.0`)
   - Publish release

   The workflow will automatically test, build, and publish to npm.

For detailed instructions, see [.github/RELEASE.md](./.github/RELEASE.md).

### Manual Publishing

To publish manually:

```bash
cd packages/manas-fm
npm publish
```

The `prepublishOnly` hook will automatically run tests, linting, and build.

### Continuous Integration

CI runs automatically on:
- Push to `main` or `develop` branches
- Pull requests

Tests run on Node.js 18.x and 20.x.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and add tests
4. Run tests and linting (`pnpm test && pnpm lint`)
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

- [GitHub Issues](https://github.com/manasdevs/file-manager/issues)
- [Full Documentation](./packages/manas-fm/README.md)
- [Example Application](./example/)
