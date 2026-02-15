import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { OperationContext } from "../types/internal.js";
import type { FolderIdentifier } from "../types/common.js";
import type { FolderListItem } from "../types/results.js";
import { FileNotFoundError } from "../errors/file-not-found-error.js";
import { directoryExists } from "../core/fs-utils.js";

export function createListFolders(ctx: OperationContext) {
  return async function listFolders(identifier: FolderIdentifier): Promise<FolderListItem[]> {
    await ctx.cleanupManager.maybeRunCleanup();

    const dirPath = ctx.pathResolver.resolveFolderPath(identifier);

    if (!(await directoryExists(dirPath))) {
      throw new FileNotFoundError(`Directory not found: ${dirPath}`, { path: dirPath });
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const result: FolderListItem[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      result.push({
        name: entry.name,
        path: path.join(dirPath, entry.name),
      });
    }

    ctx.logger.debug("Folders listed", { directory: dirPath, count: result.length });

    return result;
  };
}
