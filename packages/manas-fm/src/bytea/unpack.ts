import AdmZip from "adm-zip";
import { ValidationError } from "../errors/validation-error.js";
import { OperationError } from "../errors/operation-error.js";
import type { ByteaManifest, ByteaUnpackResult } from "./types.js";
import { BYTEA_PACK_VERSION } from "./types.js";

/** Internal: manifest entry name inside the ZIP — must match pack.ts. */
const MANIFEST_ENTRY = "manifest.json";

/** Internal: payload directory inside the ZIP — must match pack.ts. */
const PAYLOAD_DIR = "payload";

/**
 * Unpack a bytea-packed buffer back into the original file content and its
 * embedded manifest.
 *
 * @example
 * ```ts
 * import { byteaUnpack } from "manas-fm";
 *
 * const { buffer, manifest } = await byteaUnpack(packedBuffer);
 * console.log(manifest.filename); // "report.pdf"
 * // buffer is the original file bytes
 * ```
 */
export async function byteaUnpack(packed: Buffer): Promise<ByteaUnpackResult> {
  if (!Buffer.isBuffer(packed) || packed.length === 0) {
    throw new ValidationError("byteaUnpack: packed must be a non-empty Buffer");
  }

  let zip: AdmZip;
  try {
    zip = new AdmZip(packed);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new OperationError(`byteaUnpack: invalid or corrupted pack buffer: ${msg}`);
  }

  // --- Read and validate manifest ---
  const manifestEntry = zip.getEntry(MANIFEST_ENTRY);
  if (!manifestEntry) {
    throw new ValidationError(
      "byteaUnpack: pack is missing manifest.json — not a valid bytea pack",
    );
  }

  let manifest: ByteaManifest;
  try {
    const raw = manifestEntry.getData().toString("utf-8");
    manifest = JSON.parse(raw) as ByteaManifest;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ValidationError(`byteaUnpack: manifest.json is not valid JSON: ${msg}`);
  }

  // Validate required manifest fields
  if (manifest.version !== BYTEA_PACK_VERSION) {
    throw new ValidationError(
      `byteaUnpack: unsupported manifest version ${manifest.version} (expected ${BYTEA_PACK_VERSION})`,
      { version: manifest.version },
    );
  }
  if (!manifest.filename || typeof manifest.filename !== "string") {
    throw new ValidationError("byteaUnpack: manifest is missing a valid filename");
  }
  if (!manifest.mimeType || typeof manifest.mimeType !== "string") {
    throw new ValidationError("byteaUnpack: manifest is missing a valid mimeType");
  }
  if (typeof manifest.originalSize !== "number" || manifest.originalSize < 0) {
    throw new ValidationError("byteaUnpack: manifest is missing a valid originalSize");
  }

  // --- Read payload ---
  const payloadPath = `${PAYLOAD_DIR}/${manifest.filename}`;
  const payloadEntry = zip.getEntry(payloadPath);
  if (!payloadEntry) {
    throw new ValidationError(
      `byteaUnpack: pack is missing payload entry "${payloadPath}" — corrupted pack`,
      { expectedPayload: payloadPath },
    );
  }

  const buffer = payloadEntry.getData();

  return { buffer, manifest };
}
