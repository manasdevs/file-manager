import type { FileManager } from "../create-file-manager.js";
import type { FileInput, DownloadOptions, UploadProgressEvent } from "../types/common.js";
import { FileNotFoundError } from "../errors/file-not-found-error.js";
import { ValidationError } from "../errors/validation-error.js";
import { OperationError } from "../errors/operation-error.js";
import { PermissionError } from "../errors/permission-error.js";
import { ManasFmError } from "../errors/base-error.js";

function errorToResponse(error: unknown): Response {
  if (error instanceof FileNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof OperationError) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof PermissionError) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof ManasFmError) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  const message = error instanceof Error ? error.message : "Internal server error";
  return Response.json({ error: message }, { status: 500 });
}

function getAction(request: Request): string {
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  return segments[segments.length - 1] || "";
}

function getSearchParams(request: Request): URLSearchParams {
  return new URL(request.url).searchParams;
}

async function parseFileFromFormData(
  formData: FormData,
): Promise<{ file: FileInput; formData: FormData }> {
  const file = formData.get("file") as File | null;
  if (!file) {
    throw new ValidationError("Missing required field: file");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileInput: FileInput = {
    buffer,
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  };

  return { file: fileInput, formData };
}

/**
 * Creates Next.js-compatible route handlers for all manas-fm operations.
 *
 * Usage in a catch-all route (`app/api/files/[...all]/route.ts`):
 * ```ts
 * import { toNextJsHandler } from "manas-fm";
 * import { getFileManager } from "@/lib/file-manager";
 *
 * export const { GET, POST } = toNextJsHandler(getFileManager());
 * ```
 *
 * GET routes (by last URL segment):
 * - `/download` — download a file (query: slug, name, variant?)
 * - `/list` — list files or folders (query: slug, subPath?, type?)
 * - `/info` — get file info (query: slug, name)
 * - `/versions` — list versions (query: slug, name)
 *
 * POST routes (by last URL segment):
 * - `/upload` — upload a file (FormData: file, slug, subPath?, overwrite?)
 * - `/update` — update/replace a file (FormData: file, slug, name, createVersion?)
 * - `/delete` — delete a file (JSON: slug, name, deleteAllVersions?, deleteVariants?)
 * - `/rename` — rename a file (JSON: slug, name, newName, renameVersions?, renameVariants?)
 * - `/move` — move a file (JSON: slug, name, targetSlug, targetSubPath?, moveVersions?, moveVariants?)
 * - `/duplicate` — duplicate a file (JSON: slug, name, targetSlug?, newName?, duplicateVariants?)
 * - `/restore` — restore a version (JSON: slug, name, versionId)
 */
export function toNextJsHandler(fm: FileManager | Promise<FileManager>): {
  GET: (request: Request) => Promise<Response>;
  POST: (request: Request) => Promise<Response>;
} {
  const resolveFm = async () => (fm instanceof Promise ? await fm : fm);

  async function GET(request: Request): Promise<Response> {
    try {
      const manager = await resolveFm();
      const action = getAction(request);
      const params = getSearchParams(request);

      switch (action) {
        case "download": {
          const slug = params.get("slug");
          const name = params.get("name");
          if (!slug || !name) {
            return Response.json({ error: "Missing required params: slug, name" }, { status: 400 });
          }
          const variant = params.get("variant") as DownloadOptions["variant"] | null;
          const result = await manager.downloadFile(
            { slug, name },
            variant ? { variant } : undefined,
          );
          return new Response(new Uint8Array(result.buffer), {
            headers: {
              "Content-Type": result.mimeType,
              "Content-Disposition": `attachment; filename="${result.fileName}"`,
              "Content-Length": result.size.toString(),
            },
          });
        }

        case "list": {
          const slug = params.get("slug");
          if (!slug) {
            return Response.json({ error: "Missing required param: slug" }, { status: 400 });
          }
          const subPath = params.get("subPath") || undefined;
          const type = params.get("type") || "files";
          const identifier = subPath ? { slug, subPath } : { slug };

          if (type === "folders") {
            const folders = await manager.listFolders(identifier);
            return Response.json(folders);
          }
          const files = await manager.listFiles(identifier);
          return Response.json(files);
        }

        case "info": {
          const slug = params.get("slug");
          const name = params.get("name");
          if (!slug || !name) {
            return Response.json({ error: "Missing required params: slug, name" }, { status: 400 });
          }
          const info = await manager.getFileInfo({ slug, name });
          return Response.json(info);
        }

        case "versions": {
          const slug = params.get("slug");
          const name = params.get("name");
          if (!slug || !name) {
            return Response.json({ error: "Missing required params: slug, name" }, { status: 400 });
          }
          const versions = await manager.listVersions({ slug, name });
          return Response.json(versions);
        }

        default:
          return Response.json({ error: `Unknown GET action: ${action}` }, { status: 404 });
      }
    } catch (error) {
      return errorToResponse(error);
    }
  }

  async function POST(request: Request): Promise<Response> {
    try {
      const manager = await resolveFm();
      const action = getAction(request);

      switch (action) {
        case "upload": {
          const formData = await request.formData();
          const { file } = await parseFileFromFormData(formData);
          const slug = formData.get("slug") as string | null;
          if (!slug) {
            return Response.json({ error: "Missing required field: slug" }, { status: 400 });
          }
          const subPath = (formData.get("subPath") as string) || undefined;
          const overwrite = formData.get("overwrite") === "true";

          // If the client opts into streaming progress, return NDJSON events
          const wantsStream = request.headers.get("accept")?.includes("text/event-stream");

          if (wantsStream) {
            const encoder = new TextEncoder();
            const stream = new TransformStream();
            const writer = stream.writable.getWriter();

            const writeEvent = async (data: Record<string, unknown>) => {
              await writer.write(encoder.encode(JSON.stringify(data) + "\n"));
            };

            const onProgress = async (event: UploadProgressEvent) => {
              await writeEvent({ type: "progress", ...event });
            };

            // Run the upload in the background, piping events to the stream
            (async () => {
              try {
                const result = await manager.uploadFile(slug, file, {
                  subPath,
                  overwrite,
                  onProgress,
                });
                await writeEvent({ type: "result", data: result });
              } catch (err) {
                const message = err instanceof Error ? err.message : "Internal server error";
                const status =
                  err instanceof ValidationError
                    ? 400
                    : err instanceof FileNotFoundError
                      ? 404
                      : err instanceof OperationError
                        ? 409
                        : err instanceof PermissionError
                          ? 403
                          : 500;
                await writeEvent({ type: "error", error: message, status });
              } finally {
                await writer.close();
              }
            })();

            return new Response(stream.readable, {
              headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
              },
            });
          }

          // Default: non-streaming JSON response (backwards compatible)
          const result = await manager.uploadFile(slug, file, { subPath, overwrite });
          return Response.json(result, { status: 201 });
        }

        case "update": {
          const formData = await request.formData();
          const { file } = await parseFileFromFormData(formData);
          const slug = formData.get("slug") as string | null;
          const name = formData.get("name") as string | null;
          if (!slug || !name) {
            return Response.json({ error: "Missing required fields: slug, name" }, { status: 400 });
          }
          const createVersion = formData.get("createVersion") !== "false";
          const result = await manager.updateFile({ slug, name }, file, { createVersion });
          return Response.json(result);
        }

        case "delete": {
          const body = (await request.json()) as Record<string, unknown>;
          const { slug, name, deleteAllVersions, deleteVariants } = body as {
            slug?: string;
            name?: string;
            deleteAllVersions?: boolean;
            deleteVariants?: boolean;
          };
          if (!slug || !name) {
            return Response.json({ error: "Missing required fields: slug, name" }, { status: 400 });
          }
          const result = await manager.deleteFile(
            { slug, name },
            {
              deleteAllVersions: deleteAllVersions ?? true,
              deleteVariants: deleteVariants ?? true,
            },
          );
          return Response.json(result);
        }

        case "rename": {
          const body = (await request.json()) as Record<string, unknown>;
          const { slug, name, newName, renameVersions, renameVariants } = body as {
            slug?: string;
            name?: string;
            newName?: string;
            renameVersions?: boolean;
            renameVariants?: boolean;
          };
          if (!slug || !name || !newName) {
            return Response.json(
              { error: "Missing required fields: slug, name, newName" },
              { status: 400 },
            );
          }
          const result = await manager.renameFile({ slug, name }, newName, {
            renameVersions: renameVersions ?? true,
            renameVariants: renameVariants ?? true,
          });
          return Response.json(result);
        }

        case "move": {
          const body = (await request.json()) as Record<string, unknown>;
          const { slug, name, targetSlug, targetSubPath, moveVersions, moveVariants } = body as {
            slug?: string;
            name?: string;
            targetSlug?: string;
            targetSubPath?: string;
            moveVersions?: boolean;
            moveVariants?: boolean;
          };
          if (!slug || !name || !targetSlug) {
            return Response.json(
              { error: "Missing required fields: slug, name, targetSlug" },
              { status: 400 },
            );
          }
          const target = targetSubPath
            ? { slug: targetSlug, subPath: targetSubPath }
            : { slug: targetSlug };
          const result = await manager.moveFile({ slug, name }, target, {
            moveVersions: moveVersions ?? true,
            moveVariants: moveVariants ?? true,
          });
          return Response.json(result);
        }

        case "duplicate": {
          const body = (await request.json()) as Record<string, unknown>;
          const { slug, name, targetSlug, newName, duplicateVariants } = body as {
            slug?: string;
            name?: string;
            targetSlug?: string;
            newName?: string;
            duplicateVariants?: boolean;
          };
          if (!slug || !name) {
            return Response.json({ error: "Missing required fields: slug, name" }, { status: 400 });
          }
          const target = targetSlug ? { slug: targetSlug } : undefined;
          const result = await manager.duplicateFile({ slug, name }, target, {
            newName,
            duplicateVariants: duplicateVariants ?? false,
          });
          return Response.json(result, { status: 201 });
        }

        case "restore": {
          const body = (await request.json()) as Record<string, unknown>;
          const { slug, name, versionId } = body as {
            slug?: string;
            name?: string;
            versionId?: string;
          };
          if (!slug || !name || !versionId) {
            return Response.json(
              { error: "Missing required fields: slug, name, versionId" },
              { status: 400 },
            );
          }
          const result = await manager.restoreVersion({ slug, name }, versionId);
          return Response.json(result);
        }

        default:
          return Response.json({ error: `Unknown POST action: ${action}` }, { status: 404 });
      }
    } catch (error) {
      return errorToResponse(error);
    }
  }

  return { GET, POST };
}
