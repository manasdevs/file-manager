import type { ResolvedCompressionConfig } from "../types/config.js";
import type { OperationContext } from "../types/internal.js";
import { ConfigError } from "../errors/config-error.js";

/** Cache for the sharp module */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sharpModule: any = null;

/** Dynamically import sharp, caching the result */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSharp(): Promise<any> {
  if (sharpModule) return sharpModule;

  try {
    const mod = await import("sharp");
    sharpModule = mod.default ?? mod;
    return sharpModule;
  } catch {
    throw new ConfigError(
      "Compression requires 'sharp' to be installed. Install it with: npm install sharp",
    );
  }
}

/** Compress an image file and return the path to the compressed file */
export async function runCompression(
  sourceFilePath: string,
  buffer: Buffer,
  config: ResolvedCompressionConfig,
  ctx: OperationContext,
): Promise<string> {
  const sharp = await getSharp();

  const dir = ctx.pathResolver.dirname(sourceFilePath);
  const fileName = ctx.pathResolver.basename(sourceFilePath);
  const ext = ctx.pathResolver.extname(fileName);
  const nameWithoutExt = fileName.slice(0, fileName.length - ext.length);

  const compressedDir = ctx.pathResolver.resolve(dir, config.outputPath);
  await ctx.storage.ensureDirectory(compressedDir);

  const newExt = `.${config.format}`;
  const compressedPath = ctx.pathResolver.join(compressedDir, `${nameWithoutExt}${newExt}`);

  // Process image with sharp
  let pipeline = sharp(buffer);

  switch (config.format) {
    case "jpeg":
      pipeline = pipeline.jpeg({ quality: config.quality });
      break;
    case "webp":
      pipeline = pipeline.webp({ quality: config.quality });
      break;
    case "png":
      pipeline = pipeline.png({ quality: config.quality });
      break;
  }

  const compressedBuffer = await pipeline.toBuffer();
  await ctx.storage.writeFile(compressedPath, compressedBuffer);

  // Delete original if keepOriginal is false
  if (!config.keepOriginal) {
    await ctx.storage.deleteFile(sourceFilePath);
  }

  ctx.logger.info("Image compressed", {
    source: fileName,
    format: config.format,
    quality: config.quality,
    originalSize: buffer.length,
    compressedSize: compressedBuffer.length,
  });

  return compressedPath;
}
