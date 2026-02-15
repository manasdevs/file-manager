import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { OperationContext } from "../types/internal.js";
import type { FolderIdentifier } from "../types/common.js";
import type { FileListItem } from "../types/results.js";
import { FileNotFoundError } from "../errors/file-not-found-error.js";
import { directoryExists } from "../core/fs-utils.js";
import { METADATA_FILE } from "../core/path-resolver.js";

export function createListFiles(ctx: OperationContext) {
  return async function listFiles(identifier: FolderIdentifier): Promise<FileListItem[]> {
    await ctx.cleanupManager.maybeRunCleanup();

    const dirPath = ctx.pathResolver.resolveFolderPath(identifier);

    if (!(await directoryExists(dirPath))) {
      throw new FileNotFoundError(`Directory not found: ${dirPath}`, { path: dirPath });
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const index = await ctx.metadataManager.readIndex(dirPath);
    const result: FileListItem[] = [];

    // Collect known version file names to filter them out
    const versionFileNames = new Set<string>();
    for (const meta of Object.values(index.files)) {
      for (const v of meta.versions) {
        const num = parseInt(v.versionId.replace("v", ""), 10);
        // Build version file name pattern: name.vN.ext
        for (const trackedName of Object.keys(index.files)) {
          const ext = path.extname(trackedName);
          const base = trackedName.slice(0, trackedName.length - ext.length);
          versionFileNames.add(`${base}.v${num}${ext}`);
        }
      }
    }

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (entry.name === METADATA_FILE) continue;
      if (entry.name.startsWith(".manasfm.")) continue;
      if (versionFileNames.has(entry.name)) continue;

      const filePath = path.join(dirPath, entry.name);
      const stat = await fs.stat(filePath);
      const metadata = index.files[entry.name];

      result.push({
        name: entry.name,
        path: filePath,
        size: stat.size,
        mimeType: metadata?.mimeType ?? "application/octet-stream",
        createdAt: metadata?.createdAt ?? stat.birthtime.toISOString(),
      });
    }

    ctx.logger.debug("Files listed", { directory: dirPath, count: result.length });

    return result;
  };
}
