import type { OperationContext } from "../types/internal.js";
import type { FileInput } from "../types/common.js";
import type {
  ByteaPackInput,
  ByteaPackOptions,
  ByteaPackResult,
  ByteaUnpackResult,
} from "../bytea/types.js";
import { byteaPack } from "../bytea/pack.js";
import { byteaUnpack } from "../bytea/unpack.js";
import { ValidationError } from "../errors/validation-error.js";

/**
 * Create the `byteaPack` FileManager method.
 *
 * Adds slug-based validation (allowed types, max size) and auto-populates
 * the manifest `slug` field before delegating to the standalone `byteaPack`.
 */
export function createByteaPack(ctx: OperationContext) {
  return async function byteaPackOp(
    slug: string,
    file: FileInput | ByteaPackInput,
    options?: ByteaPackOptions,
  ): Promise<ByteaPackResult> {
    const slugConfig = ctx.config.slugs[slug];
    if (!slugConfig) {
      throw new ValidationError(`Unknown slug: "${slug}"`, { slug });
    }

    // Normalise to ByteaPackInput
    const input = isFileInput(file)
      ? {
          source: file.buffer,
          filename: file.originalName,
          mimeType: file.mimeType,
          custom: options?.custom,
        }
      : file;

    // Validate MIME type against slug config
    if (slugConfig.allowedTypes && slugConfig.allowedTypes.length > 0) {
      const allowed = slugConfig.allowedTypes.some((pattern) => {
        if (pattern.endsWith("/*")) {
          const prefix = pattern.slice(0, -1); // e.g. "image/"
          return input.mimeType.startsWith(prefix);
        }
        return input.mimeType === pattern;
      });
      if (!allowed) {
        throw new ValidationError(
          `MIME type "${input.mimeType}" is not allowed for slug "${slug}"`,
          { slug, mimeType: input.mimeType, allowedTypes: slugConfig.allowedTypes },
        );
      }
    }

    // Validate file size — resolve source to buffer size if possible
    if (slugConfig.maxSizeBytes != null && Buffer.isBuffer(input.source)) {
      if (input.source.length > slugConfig.maxSizeBytes) {
        throw new ValidationError(
          `File size (${input.source.length} bytes) exceeds maximum allowed size (${slugConfig.maxSizeBytes} bytes) for slug "${slug}"`,
          { slug, size: input.source.length, maxSizeBytes: slugConfig.maxSizeBytes },
        );
      }
    }

    ctx.logger.info("Packing file into bytea format", {
      slug,
      filename: input.filename,
      mimeType: input.mimeType,
    });

    const result = await byteaPack(input, options, slug);

    ctx.logger.info("Bytea pack complete", {
      slug,
      filename: result.manifest.filename,
      originalSize: result.originalSize,
      packedSize: result.packedSize,
    });

    return result;
  };
}

/**
 * Create the `byteaUnpack` FileManager method.
 *
 * Delegates to the standalone `byteaUnpack` and optionally validates that
 * the manifest slug exists in the current configuration.
 */
export function createByteaUnpack(ctx: OperationContext) {
  return async function byteaUnpackOp(packed: Buffer): Promise<ByteaUnpackResult> {
    ctx.logger.info("Unpacking bytea pack");

    const result = await byteaUnpack(packed);

    // Warn (but don't fail) if the manifest references an unknown slug
    if (result.manifest.slug && !ctx.config.slugs[result.manifest.slug]) {
      ctx.logger.warn("Unpacked manifest references unknown slug", {
        slug: result.manifest.slug,
      });
    }

    ctx.logger.info("Bytea unpack complete", {
      filename: result.manifest.filename,
      mimeType: result.manifest.mimeType,
      originalSize: result.manifest.originalSize,
    });

    return result;
  };
}

/** Type-guard: distinguish FileInput from ByteaPackInput. */
function isFileInput(input: FileInput | ByteaPackInput): input is FileInput {
  return "buffer" in input && "originalName" in input && "size" in input;
}
