"use server";

import { getFileManager } from "@/lib/file-manager";
import type {
  FileListItem,
  FolderListItem,
  FileInfo,
  UploadResult,
  OperationResult,
  VersionInfo,
} from "manas-fm";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

async function withErrorHandling<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[manas-fm action error]", message, error);
    return { success: false, error: message };
  }
}

export async function uploadFile(formData: FormData): Promise<ActionResult<UploadResult>> {
  return withErrorHandling(async () => {
    const fm = await getFileManager();
    const file = formData.get("file") as File;
    const slug = formData.get("slug") as string;
    const overwrite = formData.get("overwrite") === "true";
    const subPath = (formData.get("subPath") as string) || undefined;

    const buffer = Buffer.from(await file.arrayBuffer());
    return fm.uploadFile(
      slug,
      {
        buffer,
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      },
      { subPath, overwrite },
    );
  });
}

export async function listFiles(
  slug: string,
  subPath?: string,
): Promise<ActionResult<FileListItem[]>> {
  return withErrorHandling(async () => {
    const fm = await getFileManager();
    const identifier = subPath ? { slug, subPath } : { slug };
    return fm.listFiles(identifier);
  });
}

export async function listFolders(
  slug: string,
  subPath?: string,
): Promise<ActionResult<FolderListItem[]>> {
  return withErrorHandling(async () => {
    const fm = await getFileManager();
    const identifier = subPath ? { slug, subPath } : { slug };
    return fm.listFolders(identifier);
  });
}

export async function getFileInfo(slug: string, name: string): Promise<ActionResult<FileInfo>> {
  return withErrorHandling(async () => {
    const fm = await getFileManager();
    return fm.getFileInfo({ slug, name });
  });
}

export async function deleteFile(
  slug: string,
  name: string,
  deleteAllVersions = true,
  deleteVariants = true,
): Promise<ActionResult<OperationResult>> {
  return withErrorHandling(async () => {
    const fm = await getFileManager();
    return fm.deleteFile({ slug, name }, { deleteAllVersions, deleteVariants });
  });
}

export async function updateFile(formData: FormData): Promise<ActionResult<UploadResult>> {
  return withErrorHandling(async () => {
    const fm = await getFileManager();
    const file = formData.get("file") as File;
    const slug = formData.get("slug") as string;
    const name = formData.get("name") as string;
    const createVersion = formData.get("createVersion") !== "false";

    const buffer = Buffer.from(await file.arrayBuffer());
    return fm.updateFile(
      { slug, name },
      {
        buffer,
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      },
      { createVersion },
    );
  });
}

export async function renameFile(
  slug: string,
  name: string,
  newName: string,
  renameVersions = true,
  renameVariants = true,
): Promise<ActionResult<OperationResult>> {
  return withErrorHandling(async () => {
    const fm = await getFileManager();
    return fm.renameFile({ slug, name }, newName, { renameVersions, renameVariants });
  });
}

export async function moveFile(
  slug: string,
  name: string,
  targetSlug: string,
  targetSubPath?: string,
  moveVersions = true,
  moveVariants = true,
): Promise<ActionResult<OperationResult>> {
  return withErrorHandling(async () => {
    const fm = await getFileManager();
    const target = targetSubPath
      ? { slug: targetSlug, subPath: targetSubPath }
      : { slug: targetSlug };
    return fm.moveFile({ slug, name }, target, { moveVersions, moveVariants });
  });
}

export async function duplicateFile(
  slug: string,
  name: string,
  targetSlug?: string,
  newName?: string,
  duplicateVariants = false,
): Promise<ActionResult<OperationResult>> {
  return withErrorHandling(async () => {
    const fm = await getFileManager();
    const target = targetSlug ? { slug: targetSlug } : undefined;
    return fm.duplicateFile({ slug, name }, target, { newName, duplicateVariants });
  });
}

export async function listVersions(
  slug: string,
  name: string,
): Promise<ActionResult<VersionInfo[]>> {
  return withErrorHandling(async () => {
    const fm = await getFileManager();
    return fm.listVersions({ slug, name });
  });
}

export async function restoreVersion(
  slug: string,
  name: string,
  versionId: string,
): Promise<ActionResult<OperationResult>> {
  return withErrorHandling(async () => {
    const fm = await getFileManager();
    return fm.restoreVersion({ slug, name }, versionId);
  });
}
