import type { OperationContext } from "../types/internal.js";
import type { FolderIdentifier } from "../types/common.js";
import type { FileListItem } from "../types/results.js";
import { FileNotFoundError } from "../errors/file-not-found-error.js";
import { METADATA_FILE } from "../core/path-resolver.js";

export function createListFiles(ctx: OperationContext) {
  return async function listFiles(identifier: FolderIdentifier): Promise<FileListItem[]> {
    await ctx.cleanupManager.maybeRunCleanup();

    const dirPath = ctx.pathResolver.resolveFolderPath(identifier);

    // Check directory existence. For cloud storage, listing an empty/non-existent prefix
    // returns [] which is acceptable. For local storage, listFiles will throw.
    let storageItems;
    try {
      storageItems = await ctx.storage.listFiles(dirPath);
    } catch {
      throw new FileNotFoundError(`Directory not found: ${dirPath}`, { path: dirPath });
    }

    const index = await ctx.metadataManager.readIndex(dirPath);
    const result: FileListItem[] = [];

    // Collect known version file names to filter them out
    const versionFileNames = new Set<string>();
    for (const meta of Object.values(index.files)) {
      for (const v of meta.versions) {
        const num = parseInt(v.versionId.replace("v", ""), 10);
        for (const trackedName of Object.keys(index.files)) {
          const ext = ctx.pathResolver.extname(trackedName);
          const base = trackedName.slice(0, trackedName.length - ext.length);
          versionFileNames.add(`${base}.v${num}${ext}`);
        }
      }
    }

    for (const item of storageItems) {
      if (item.name === METADATA_FILE) continue;
      if (item.name.startsWith(".manasfm.")) continue;
      if (versionFileNames.has(item.name)) continue;

      const metadata = index.files[item.name];

      result.push({
        name: item.name,
        path: item.key,
        size: item.size,
        mimeType: metadata?.mimeType ?? "application/octet-stream",
        createdAt: metadata?.createdAt ?? item.lastModified.toISOString(),
      });
    }

    ctx.logger.debug("Files listed", { directory: dirPath, count: result.length });

    return result;
  };
}
