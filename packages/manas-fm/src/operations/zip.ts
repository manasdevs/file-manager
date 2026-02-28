import archiver from "archiver";
import type { ResolvedZipConfig } from "../types/config.js";
import type { OperationContext } from "../types/internal.js";

/** Create a zip archive of a file and return the path to the zip */
export async function runZip(
  sourceFilePath: string,
  config: ResolvedZipConfig,
  ctx: OperationContext,
): Promise<string> {
  const dir = ctx.pathResolver.dirname(sourceFilePath);
  const fileName = ctx.pathResolver.basename(sourceFilePath);

  const zipDir = ctx.pathResolver.resolve(dir, config.outputPath);
  await ctx.storage.ensureDirectory(zipDir);

  const zipPath = ctx.pathResolver.join(zipDir, `${fileName}.zip`);

  // Read the source file into a buffer for cloud-compatible archiving
  const sourceBuffer = await ctx.storage.readFile(sourceFilePath);

  await new Promise<void>((resolve, reject) => {
    (async () => {
      try {
        const output = await ctx.storage.createWriteStream(zipPath);
        const archive = archiver("zip", { zlib: { level: 9 } });

        output.on("close", resolve);
        output.on("error", reject);
        archive.on("error", reject);

        archive.pipe(output);
        archive.append(sourceBuffer, { name: fileName });
        archive.finalize();
      } catch (err) {
        reject(err);
      }
    })();
  });

  // Delete original if keepOriginal is false
  if (!config.keepOriginal) {
    await ctx.storage.deleteFile(sourceFilePath);
  }

  ctx.logger.info("File archived", {
    source: fileName,
    zipPath,
  });

  return zipPath;
}
