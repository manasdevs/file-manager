import type { Readable } from "node:stream";

/**
 * Source input for a bytea pack operation.
 * - `Buffer` — raw file bytes
 * - `string` — absolute or relative file path (read from disk)
 * - `Readable` — Node.js readable stream (collected into a buffer)
 */
export type ByteaPackSource = Buffer | string | Readable;

/** Input descriptor for packing a file into a bytea-ready buffer. */
export interface ByteaPackInput {
  /** The file content — a Buffer, file path, or Readable stream. */
  source: ByteaPackSource;
  /** Original filename (e.g. "report.pdf"). Stored in the manifest and used as the payload entry name. */
  filename: string;
  /** MIME type of the file (e.g. "application/pdf"). */
  mimeType: string;
  /** Optional custom metadata to embed in the manifest (must be JSON-serialisable). */
  custom?: Record<string, unknown>;
}

/** Options for the bytea pack operation. */
export interface ByteaPackOptions {
  /**
   * Zlib compression level (0 = no compression, 9 = maximum compression).
   * @default 9
   */
  compressionLevel?: number;
  /** Optional custom metadata merged into the manifest. Overrides `input.custom` keys on conflict. */
  custom?: Record<string, unknown>;
}

/** Format version of the bytea pack manifest. */
export const BYTEA_PACK_VERSION = 1 as const;

/** Structured manifest embedded in every bytea pack. */
export interface ByteaManifest {
  /** Format version — always `1` for now. */
  version: typeof BYTEA_PACK_VERSION;
  /** Slug the file belongs to (populated when packed via FileManager). */
  slug?: string;
  /** Original filename. */
  filename: string;
  /** MIME type of the packed file. */
  mimeType: string;
  /** Original (uncompressed) file size in bytes. */
  originalSize: number;
  /** ISO-8601 timestamp when the source file was provided / created. */
  createdAt: string;
  /** ISO-8601 timestamp when the pack was produced. */
  packedAt: string;
  /** Arbitrary user metadata. */
  custom?: Record<string, unknown>;
}

/** Result returned by `byteaPack()`. */
export interface ByteaPackResult {
  /** The raw ZIP buffer, ready for direct PostgreSQL `bytea` storage. */
  buffer: Buffer;
  /** A copy of the embedded manifest for convenience. */
  manifest: ByteaManifest;
  /** Size of the packed buffer in bytes. */
  packedSize: number;
  /** Original file size in bytes (before packing / compression). */
  originalSize: number;
}

/** Result returned by `byteaUnpack()`. */
export interface ByteaUnpackResult {
  /** The restored original file content. */
  buffer: Buffer;
  /** The manifest that was embedded in the pack. */
  manifest: ByteaManifest;
}
