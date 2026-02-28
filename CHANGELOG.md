# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v1.4.6] — v1.4.6

### Added

- **Per-slug storage overrides** — each slug in `SlugConfig` can now declare its own `storage` key to use a completely different storage backend (S3, Azure, Firebase, local, etc.) independently from the global storage configuration.
- **`RouterStorageAdapter`** — a new internal (and exported) adapter that transparently routes every file I/O call to the correct per-slug backend. Handles cross-storage `copyFile` / `moveFile` automatically via read → write.
- `storage?: StorageConfig` added to `SlugConfig` type.
- `storage: ValidatedStorageConfig` added to `ResolvedSlugConfig` type (resolved at config validation time).
- `RouterStorageAdapter` exported from the main entry point for advanced custom composition.

### Changed

- `PathResolver` now uses per-slug `isCloud` flags for correct path construction and validation when slugs use different storage modes than the global config.
- `config-validator` resolves per-slug storage independently and resolves the slug path relative to the slug's own storage root when overridden.
- `createFileManager` builds a per-slug adapter `Map` and wires `RouterStorageAdapter` as the top-level storage when any slug overrides are present — zero changes required in operations, `MetadataManager`, or `CleanupManager`.

### Fixed

- Example code and documentation corrected to use `s3Provider` instead of the non-existent `preset` field on `S3StorageConfig`.

---

## [1.3.6] — 2025-01-01

### Added

- **Cloud object storage support** — 12+ providers out of the box via a unified `StorageAdapter` abstraction:
  - **AWS S3** (and all S3-compatible providers via `s3Provider` presets)
  - **Google Cloud Storage** (via S3-compatible API)
  - **DigitalOcean Spaces**
  - **Backblaze B2**
  - **Wasabi**
  - **Cloudflare R2**
  - **MinIO** (self-hosted)
  - **Oracle Cloud Object Storage**
  - **IBM Cloud Object Storage**
  - **Supabase Storage**
  - **Azure Blob Storage**
  - **Firebase Storage**
- `StorageAdapter` interface with 12 methods (`writeFile`, `readFile`, `deleteFile`, `copyFile`, `moveFile`, `fileExists`, `getFileStats`, `listFiles`, `listDirectories`, `ensureDirectory`, `createWriteStream`, `getFileUrl`).
- `LocalStorageAdapter`, `S3StorageAdapter`, `AzureBlobStorageAdapter`, `FirebaseStorageAdapter` implementations.
- `S3_PRESETS` and `resolveEndpoint` exported for advanced S3-compatible configuration.
- `StorageConfig` discriminated union type (`LocalStorageConfig | S3StorageConfig | AzureStorageConfig | FirebaseStorageConfig | CustomStorageConfig`).
- `CustomStorageConfig` — bring your own `StorageAdapter` implementation.
- `PathResolver` dual-mode: local filesystem paths and cloud key prefixes.
- All 13 file operations refactored from direct `node:fs` calls to `StorageAdapter`.
- `MetadataManager` and `CleanupManager` refactored to use `StorageAdapter`.
- Cloud SDK packages (`@aws-sdk/client-s3`, `@azure/storage-blob`, `firebase-admin`) declared as optional peer dependencies.
- **CLI** updated with interactive cloud storage provider selection, `.env.example` generation, and cloud SDK installation.

### Fixed

- `@typescript-eslint/consistent-type-imports` lint violations resolved across the codebase.

---

## [1.2.6] — 2024-12-01

### Added

- **File naming strategies** — control how uploaded files are named on disk. Set globally via `fileNaming.strategy` or override per slug.
  - `"original"` (default) — preserves the uploaded filename.
  - `"uuid"` — replaces the filename with a UUID.
  - `"name-uuid"` — appends a UUID to the original name (`photo-<uuid>.jpg`).
  - `"name-number"` — appends an incrementing number (`photo-1.jpg`, `photo-2.jpg`).
  - `"name-timestamp"` — appends a Unix timestamp.
  - `"timestamp"` — replaces the filename with a Unix timestamp.
- Original filename always preserved in metadata regardless of naming strategy.

---

## [1.1.6] — 2024-11-01

### Added

- **Upload progress tracking** — `uploadFile` accepts an `onProgress` callback that receives `{ phase, percent, message }` events.
- Upload phases: `validating`, `writing`, `zipping`, `compressing`, `saving-metadata`, `complete`.
- `UploadProgressEvent` and `UploadPhase` types exported.
- `useUploadProgress` React hook in the Next.js example for client-side progress UI.
- `llms.txt` — machine-readable documentation file for LLM context.

---

## [1.0.5] — 2024-10-15

### Added

- **`add-manas-fm` CLI** — scaffolding tool that installs the library and generates all required files for a Next.js project with a single command.
  - Interactive prompts: project detection, slug configuration, file naming, versioning, compression, zip.
  - Generates: `file-manager.ts`, API route (`[...all]/route.ts`), server actions, `useUploadProgress` hook.
  - Supports `npm`, `pnpm`, and `yarn`.
- CI/CD workflow for publishing the CLI to npm with change detection.

---

## [1.0.4] — 2024-10-01

### Added

- Initial public release of `manas-fm`.
- **Core file operations**: `uploadFile`, `downloadFile`, `listFiles`, `listFolders`, `getFileInfo`, `deleteFile`, `updateFile`, `renameFile`, `moveFile`, `duplicateFile`.
- **Versioning** — automatic version history on file update, configurable max versions per slug.
- **Compression** — automatic image compression via `sharp` (JPEG, WebP, PNG). Configurable quality and output format.
- **Zip** — automatic zip archiving of uploaded files via `archiver`.
- **Retention / cleanup** — automatic deletion of files past their `retentionDays` TTL.
- **Slug system** — isolate different upload types (e.g. `images`, `documents`, `uploads`) with independent path, type, size, and feature config.
- **Next.js adapter** — `toNextJsHandler` wraps the file manager for use in App Router API routes.
- **Custom error classes** — `ConfigError`, `ValidationError`, `StorageError`, `OperationError`, `PermissionError`, `FileNotFoundError`.
- **Metadata index** — per-directory `.manasfm.index.json` tracks file metadata, versions, and variants.
- TypeScript-first with full type exports.
- Next.js example app demonstrating full integration (API route, server actions, upload progress).

[Unreleased]: https://github.com/manasdevs/file-manager/compare/v1.3.6...HEAD
[1.3.6]: https://github.com/manasdevs/file-manager/compare/v1.2.6...v1.3.6
[1.2.6]: https://github.com/manasdevs/file-manager/compare/v1.1.6...v1.2.6
[1.1.6]: https://github.com/manasdevs/file-manager/compare/v1.0.5...v1.1.6
[1.0.5]: https://github.com/manasdevs/file-manager/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/manasdevs/file-manager/releases/tag/v1.0.4
