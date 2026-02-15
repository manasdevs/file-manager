import * as path from "node:path";
import * as fs from "node:fs";
import archiver from "archiver";
import type { ResolvedZipConfig } from "../types/config.js";
import type { OperationContext } from "../types/internal.js";
import { ensureDirectory, safeDeleteFile } from "../core/fs-utils.js";

/** Create a zip archive of a file and return the path to the zip */
export async function runZip(
  sourceFilePath: string,
  config: ResolvedZipConfig,
  ctx: OperationContext,
): Promise<string> {
  const dir = path.dirname(sourceFilePath);
  const fileName = path.basename(sourceFilePath);

  const zipDir = path.resolve(dir, config.outputPath);
  await ensureDirectory(zipDir);

  const zipPath = path.join(zipDir, `${fileName}.zip`);

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);

    archive.pipe(output);
    archive.file(sourceFilePath, { name: fileName });
    archive.finalize();
  });

  // Delete original if keepOriginal is false
  if (!config.keepOriginal) {
    await safeDeleteFile(sourceFilePath);
  }

  ctx.logger.info("File archived", {
    source: fileName,
    zipPath,
  });

  return zipPath;
}
