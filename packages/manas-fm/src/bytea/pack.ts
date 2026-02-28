import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import type { Readable } from "node:stream";
import archiver from "archiver";
import { ValidationError } from "../errors/validation-error.js";
import { OperationError } from "../errors/operation-error.js";
import type { ByteaPackInput, ByteaPackOptions, ByteaPackResult, ByteaManifest } from "./types.js";
import { BYTEA_PACK_VERSION } from "./types.js";

/** Internal: manifest entry name inside the ZIP. */
const MANIFEST_ENTRY = "manifest.json";

/** Internal: payload directory inside the ZIP. */
const PAYLOAD_DIR = "payload";

// ---------------------------------------------------------------------------
// Source resolution
// ---------------------------------------------------------------------------

/** Resolve a `ByteaPackSource` to a raw `Buffer`. */
async function resolveSource(source: ByteaPackInput["source"]): Promise<Buffer> {
  if (Buffer.isBuffer(source)) {
    return source;
  }

  if (typeof source === "string") {
    try {
      return await readFile(source);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new OperationError(`Failed to read file at path "${source}": ${msg}`, {
        path: source,
      });
    }
  }

  // Readable stream — collect all chunks into a single buffer.
  return collectStream(source);
}

/** Collect a Readable stream into a single Buffer. */
function collectStream(stream: Readable): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", (err) =>
      reject(new OperationError(`Failed to read from stream: ${err.message}`)),
    );
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Package a file into a compressed, ZIP-based binary format ready for
 * direct storage in a PostgreSQL `bytea` column.
 *
 * The resulting buffer contains:
 * - `manifest.json` — structured metadata (slug, filename, MIME type, timestamps, custom data)
 * - `payload/<filename>` — the original file bytes
 *
 * No base64 encoding is used — the returned buffer preserves original binary
 * size and can be inserted via parameterised queries (`$1::bytea`).
 *
 * @example
 * ```ts
 * import { byteaPack } from "manas-fm";
 *
 * const packed = await byteaPack({
 *   source: fileBuffer,
 *   filename: "report.pdf",
 *   mimeType: "application/pdf",
 * });
 *
 * await sql`INSERT INTO files (data) VALUES (${packed.buffer})`;
 * ```
 */
export async function byteaPack(
  input: ByteaPackInput,
  options: ByteaPackOptions = {},
  slug?: string,
): Promise<ByteaPackResult> {
  // --- Validate input ---
  if (!input.filename || typeof input.filename !== "string") {
    throw new ValidationError("byteaPack: filename is required and must be a non-empty string");
  }
  if (!input.mimeType || typeof input.mimeType !== "string") {
    throw new ValidationError("byteaPack: mimeType is required and must be a non-empty string");
  }
  if (input.source == null) {
    throw new ValidationError("byteaPack: source is required (Buffer, file path, or Readable)");
  }

  const compressionLevel = options.compressionLevel ?? 9;
  if (compressionLevel < 0 || compressionLevel > 9 || !Number.isInteger(compressionLevel)) {
    throw new ValidationError("byteaPack: compressionLevel must be an integer between 0 and 9", {
      compressionLevel,
    });
  }

  // --- Resolve source to buffer ---
  const sourceBuffer = await resolveSource(input.source);
  const originalSize = sourceBuffer.length;

  // --- Build manifest ---
  const now = new Date().toISOString();
  const custom =
    input.custom || options.custom
      ? { ...(input.custom ?? {}), ...(options.custom ?? {}) }
      : undefined;

  const manifest: ByteaManifest = {
    version: BYTEA_PACK_VERSION,
    ...(slug ? { slug } : {}),
    filename: input.filename,
    mimeType: input.mimeType,
    originalSize,
    createdAt: now,
    packedAt: now,
    ...(custom ? { custom } : {}),
  };

  // --- Create ZIP archive in memory ---
  const packedBuffer = await createPackBuffer(manifest, sourceBuffer, compressionLevel);

  return {
    buffer: packedBuffer,
    manifest,
    packedSize: packedBuffer.length,
    originalSize,
  };
}

// ---------------------------------------------------------------------------
// Internal: in-memory ZIP creation
// ---------------------------------------------------------------------------

function createPackBuffer(
  manifest: ByteaManifest,
  payload: Buffer,
  compressionLevel: number,
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: compressionLevel } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", (err) =>
      reject(new OperationError(`byteaPack: archiver failed: ${err.message}`)),
    );

    // Append manifest
    archive.append(JSON.stringify(manifest, null, 2), { name: MANIFEST_ENTRY });

    // Append payload under payload/<filename>
    archive.append(payload, { name: `${PAYLOAD_DIR}/${manifest.filename}` });

    archive.finalize();
  });
}
