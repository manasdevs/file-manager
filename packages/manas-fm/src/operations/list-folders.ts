import type { OperationContext } from "../types/internal.js";
import type { FolderIdentifier } from "../types/common.js";
import type { FolderListItem } from "../types/results.js";
import { FileNotFoundError } from "../errors/file-not-found-error.js";

export function createListFolders(ctx: OperationContext) {
  return async function listFolders(identifier: FolderIdentifier): Promise<FolderListItem[]> {
    await ctx.cleanupManager.maybeRunCleanup();

    const dirPath = ctx.pathResolver.resolveFolderPath(identifier);

    let dirs;
    try {
      dirs = await ctx.storage.listDirectories(dirPath);
    } catch {
      throw new FileNotFoundError(`Directory not found: ${dirPath}`, { path: dirPath });
    }

    const result: FolderListItem[] = [];

    for (const dir of dirs) {
      result.push({
        name: dir.name,
        path: dir.key,
      });
    }

    ctx.logger.debug("Folders listed", { directory: dirPath, count: result.length });

    return result;
  };
}
