/**
 * Generate Next.js server actions for manas-fm operations.
 */
export function generateServerActions(isTypeScript: boolean, aliasImport: string): string {
  const lines: string[] = [];

  lines.push(`"use server";`);
  lines.push(``);
  lines.push(`import { getFileManager } from "${aliasImport}";`);

  if (isTypeScript) {
    lines.push(`import type {`);
    lines.push(`  FileListItem,`);
    lines.push(`  FolderListItem,`);
    lines.push(`  FileInfo,`);
    lines.push(`  UploadResult,`);
    lines.push(`  OperationResult,`);
    lines.push(`  VersionInfo,`);
    lines.push(`} from "manas-fm";`);
    lines.push(``);
    lines.push(
      `type ActionResult<T> = { success: true; data: T } | { success: false; error: string };`,
    );
    lines.push(``);
    lines.push(
      `async function withErrorHandling<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {`,
    );
  } else {
    lines.push(``);
    lines.push(`async function withErrorHandling(fn) {`);
  }

  lines.push(`  try {`);
  lines.push(`    const data = await fn();`);
  lines.push(`    return { success: true, data };`);
  lines.push(`  } catch (error) {`);
  lines.push(`    const message = error instanceof Error ? error.message : "Unknown error";`);
  lines.push(`    console.error("[manas-fm action error]", message, error);`);
  lines.push(`    return { success: false, error: message };`);
  lines.push(`  }`);
  lines.push(`}`);
  lines.push(``);

  // Upload action
  if (isTypeScript) {
    lines.push(
      `export async function uploadFile(formData: FormData): Promise<ActionResult<UploadResult>> {`,
    );
  } else {
    lines.push(`export async function uploadFile(formData) {`);
  }
  lines.push(`  return withErrorHandling(async () => {`);
  lines.push(`    const fm = await getFileManager();`);
  lines.push(`    const file = formData.get("file");`);
  lines.push(`    const slug = formData.get("slug");`);
  lines.push(`    const overwrite = formData.get("overwrite") === "true";`);
  lines.push(`    const subPath = formData.get("subPath") || undefined;`);
  lines.push(``);
  lines.push(`    const buffer = Buffer.from(await file.arrayBuffer());`);
  lines.push(`    return fm.uploadFile(`);
  lines.push(`      slug,`);
  lines.push(`      {`);
  lines.push(`        buffer,`);
  lines.push(`        originalName: file.name,`);
  lines.push(`        mimeType: file.type || "application/octet-stream",`);
  lines.push(`        size: file.size,`);
  lines.push(`      },`);
  lines.push(`      { subPath, overwrite },`);
  lines.push(`    );`);
  lines.push(`  });`);
  lines.push(`}`);
  lines.push(``);

  // List files action
  if (isTypeScript) {
    lines.push(
      `export async function listFiles(slug: string, subPath?: string): Promise<ActionResult<FileListItem[]>> {`,
    );
  } else {
    lines.push(`export async function listFiles(slug, subPath) {`);
  }
  lines.push(`  return withErrorHandling(async () => {`);
  lines.push(`    const fm = await getFileManager();`);
  lines.push(`    return fm.listFiles({ slug, subPath });`);
  lines.push(`  });`);
  lines.push(`}`);
  lines.push(``);

  // List folders action
  if (isTypeScript) {
    lines.push(
      `export async function listFolders(slug: string, subPath?: string): Promise<ActionResult<FolderListItem[]>> {`,
    );
  } else {
    lines.push(`export async function listFolders(slug, subPath) {`);
  }
  lines.push(`  return withErrorHandling(async () => {`);
  lines.push(`    const fm = await getFileManager();`);
  lines.push(`    return fm.listFolders({ slug, subPath });`);
  lines.push(`  });`);
  lines.push(`}`);
  lines.push(``);

  // Get file info action
  if (isTypeScript) {
    lines.push(
      `export async function getFileInfo(slug: string, name: string, subPath?: string): Promise<ActionResult<FileInfo>> {`,
    );
  } else {
    lines.push(`export async function getFileInfo(slug, name, subPath) {`);
  }
  lines.push(`  return withErrorHandling(async () => {`);
  lines.push(`    const fm = await getFileManager();`);
  lines.push(`    return fm.getFileInfo({ slug, name, subPath });`);
  lines.push(`  });`);
  lines.push(`}`);
  lines.push(``);

  // Delete file action
  if (isTypeScript) {
    lines.push(
      `export async function deleteFile(slug: string, name: string, subPath?: string): Promise<ActionResult<OperationResult>> {`,
    );
  } else {
    lines.push(`export async function deleteFile(slug, name, subPath) {`);
  }
  lines.push(`  return withErrorHandling(async () => {`);
  lines.push(`    const fm = await getFileManager();`);
  lines.push(`    return fm.deleteFile({ slug, name, subPath });`);
  lines.push(`  });`);
  lines.push(`}`);
  lines.push(``);

  return lines.join("\n");
}
