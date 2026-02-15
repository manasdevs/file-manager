import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { createFileManager } from "../create-file-manager.js";
import { createTestDir, cleanTestDir, createTestFile, createTestConfig } from "./helpers.js";
import { ValidationError } from "../errors/validation-error.js";
import { FileNotFoundError } from "../errors/file-not-found-error.js";
import { OperationError } from "../errors/operation-error.js";

describe("Integration tests", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await cleanTestDir(testDir);
  });

  describe("Full lifecycle", () => {
    it("upload -> list -> info -> download -> rename -> move -> duplicate -> delete", async () => {
      const fm = await createFileManager(
        createTestConfig(testDir, {
          slugs: {
            uploads: { path: "uploads" },
            docs: { path: "docs" },
          },
        }),
      );

      // Upload
      const file = createTestFile("hello world", "test.txt");
      const uploadResult = await fm.uploadFile("uploads", file);
      expect(uploadResult.success).toBe(true);
      expect(uploadResult.fileName).toBe("test.txt");
      expect(uploadResult.slug).toBe("uploads");

      // List files
      const files = await fm.listFiles({ slug: "uploads" });
      expect(files).toHaveLength(1);
      expect(files[0].name).toBe("test.txt");

      // Get file info
      const info = await fm.getFileInfo({ slug: "uploads", name: "test.txt" });
      expect(info.name).toBe("test.txt");
      expect(info.size).toBe(file.size);
      expect(info.mimeType).toBe("text/plain");

      // Download
      const download = await fm.downloadFile({ slug: "uploads", name: "test.txt" });
      expect(download.buffer.toString()).toBe("hello world");
      expect(download.fileName).toBe("test.txt");

      // Rename
      const renameResult = await fm.renameFile(
        { slug: "uploads", name: "test.txt" },
        "renamed.txt",
      );
      expect(renameResult.success).toBe(true);

      // Verify renamed file exists
      const filesAfterRename = await fm.listFiles({ slug: "uploads" });
      expect(filesAfterRename).toHaveLength(1);
      expect(filesAfterRename[0].name).toBe("renamed.txt");

      // Move to docs
      const moveResult = await fm.moveFile(
        { slug: "uploads", name: "renamed.txt" },
        { slug: "docs" },
      );
      expect(moveResult.success).toBe(true);

      const uploadsAfterMove = await fm.listFiles({ slug: "uploads" });
      expect(uploadsAfterMove).toHaveLength(0);
      const docsAfterMove = await fm.listFiles({ slug: "docs" });
      expect(docsAfterMove).toHaveLength(1);

      // Duplicate
      const dupResult = await fm.duplicateFile({ slug: "docs", name: "renamed.txt" }, undefined, {
        newName: "copy.txt",
      });
      expect(dupResult.success).toBe(true);

      const docsAfterDup = await fm.listFiles({ slug: "docs" });
      expect(docsAfterDup).toHaveLength(2);

      // Delete
      const deleteResult = await fm.deleteFile({ slug: "docs", name: "renamed.txt" });
      expect(deleteResult.success).toBe(true);
      const docsAfterDelete = await fm.listFiles({ slug: "docs" });
      expect(docsAfterDelete).toHaveLength(1);
      expect(docsAfterDelete[0].name).toBe("copy.txt");
    });
  });

  describe("Upload validation", () => {
    it("rejects unknown slug", async () => {
      const fm = await createFileManager(createTestConfig(testDir));
      const file = createTestFile();
      await expect(fm.uploadFile("unknown", file)).rejects.toBeInstanceOf(ValidationError);
    });

    it("rejects disallowed MIME type", async () => {
      const fm = await createFileManager(
        createTestConfig(testDir, {
          slugs: {
            images: {
              path: "images",
              allowedTypes: ["image/jpeg", "image/png"],
            },
          },
        }),
      );
      const file = createTestFile("data", "file.txt", "text/plain");
      await expect(fm.uploadFile("images", file)).rejects.toBeInstanceOf(ValidationError);
    });

    it("rejects oversized file", async () => {
      const fm = await createFileManager(
        createTestConfig(testDir, {
          slugs: {
            small: {
              path: "small",
              maxSizeBytes: 5,
            },
          },
        }),
      );
      const file = createTestFile("this is longer than 5 bytes");
      await expect(fm.uploadFile("small", file)).rejects.toBeInstanceOf(ValidationError);
    });

    it("rejects duplicate without overwrite", async () => {
      const fm = await createFileManager(createTestConfig(testDir));
      const file = createTestFile();
      await fm.uploadFile("uploads", file);
      await expect(fm.uploadFile("uploads", file)).rejects.toBeInstanceOf(OperationError);
    });

    it("allows duplicate with overwrite", async () => {
      const fm = await createFileManager(createTestConfig(testDir));
      const file = createTestFile("version 1");
      await fm.uploadFile("uploads", file);
      const file2 = createTestFile("version 2", "test.txt");
      const result = await fm.uploadFile("uploads", file2, { overwrite: true });
      expect(result.success).toBe(true);
    });
  });

  describe("Versioning", () => {
    it("creates versions on update", async () => {
      const fm = await createFileManager(
        createTestConfig(testDir, {
          versioning: { enabledByDefault: true, maxVersions: 5 },
          slugs: { uploads: { path: "uploads" } },
        }),
      );

      const file1 = createTestFile("version 1", "doc.txt");
      await fm.uploadFile("uploads", file1);

      const file2 = createTestFile("version 2", "doc.txt");
      await fm.updateFile({ slug: "uploads", name: "doc.txt" }, file2);

      const versions = await fm.listVersions({ slug: "uploads", name: "doc.txt" });
      expect(versions).toHaveLength(1);
      expect(versions[0].versionId).toBe("v1");

      // Current file should be version 2
      const download = await fm.downloadFile({ slug: "uploads", name: "doc.txt" });
      expect(download.buffer.toString()).toBe("version 2");
    });

    it("restores a version", async () => {
      const fm = await createFileManager(
        createTestConfig(testDir, {
          versioning: { enabledByDefault: true, maxVersions: 5 },
          slugs: { uploads: { path: "uploads" } },
        }),
      );

      const file1 = createTestFile("original content", "doc.txt");
      await fm.uploadFile("uploads", file1);

      const file2 = createTestFile("updated content", "doc.txt");
      await fm.updateFile({ slug: "uploads", name: "doc.txt" }, file2);

      // Restore v1
      const restoreResult = await fm.restoreVersion({ slug: "uploads", name: "doc.txt" }, "v1");
      expect(restoreResult.success).toBe(true);

      const download = await fm.downloadFile({ slug: "uploads", name: "doc.txt" });
      expect(download.buffer.toString()).toBe("original content");
    });

    it("enforces maxVersions", async () => {
      const fm = await createFileManager(
        createTestConfig(testDir, {
          versioning: { enabledByDefault: true, maxVersions: 2 },
          slugs: { uploads: { path: "uploads" } },
        }),
      );

      const file1 = createTestFile("v1", "doc.txt");
      await fm.uploadFile("uploads", file1);

      // Create 3 updates (should exceed maxVersions of 2)
      for (let i = 2; i <= 4; i++) {
        const fileN = createTestFile(`v${i}`, "doc.txt");
        await fm.updateFile({ slug: "uploads", name: "doc.txt" }, fileN);
      }

      const versions = await fm.listVersions({ slug: "uploads", name: "doc.txt" });
      expect(versions.length).toBeLessThanOrEqual(2);
    });
  });

  describe("Delete options", () => {
    it("deletes file and versions", async () => {
      const fm = await createFileManager(
        createTestConfig(testDir, {
          versioning: { enabledByDefault: true, maxVersions: 5 },
          slugs: { uploads: { path: "uploads" } },
        }),
      );

      await fm.uploadFile("uploads", createTestFile("v1", "doc.txt"));
      await fm.updateFile({ slug: "uploads", name: "doc.txt" }, createTestFile("v2", "doc.txt"));

      await fm.deleteFile({ slug: "uploads", name: "doc.txt" }, { deleteAllVersions: true });

      const files = await fm.listFiles({ slug: "uploads" });
      // Should have no regular files (version files may start with . or be filtered)
      const mainFiles = files.filter((f) => !f.name.includes(".v"));
      expect(mainFiles).toHaveLength(0);
    });
  });

  describe("List folders", () => {
    it("lists subdirectories", async () => {
      const fm = await createFileManager(createTestConfig(testDir));

      // Create subdirectories
      await fs.mkdir(path.join(testDir, "uploads", "sub1"), { recursive: true });
      await fs.mkdir(path.join(testDir, "uploads", "sub2"), { recursive: true });

      const folders = await fm.listFolders({ slug: "uploads" });
      expect(folders).toHaveLength(2);
      const names = folders.map((f) => f.name).sort();
      expect(names).toEqual(["sub1", "sub2"]);
    });
  });

  describe("Subpath uploads", () => {
    it("uploads to a subdirectory", async () => {
      const fm = await createFileManager(createTestConfig(testDir));
      const file = createTestFile("nested content", "nested.txt");

      const result = await fm.uploadFile("uploads", file, { subPath: "deep/nested" });
      expect(result.success).toBe(true);

      const files = await fm.listFiles({ slug: "uploads", subPath: "deep/nested" });
      expect(files).toHaveLength(1);
      expect(files[0].name).toBe("nested.txt");
    });
  });

  describe("File not found", () => {
    it("throws on download of non-existent file", async () => {
      const fm = await createFileManager(createTestConfig(testDir));
      await expect(fm.downloadFile({ slug: "uploads", name: "nope.txt" })).rejects.toBeInstanceOf(
        FileNotFoundError,
      );
    });

    it("throws on getFileInfo of non-existent file", async () => {
      const fm = await createFileManager(createTestConfig(testDir));
      await expect(fm.getFileInfo({ slug: "uploads", name: "nope.txt" })).rejects.toBeInstanceOf(
        FileNotFoundError,
      );
    });

    it("throws on delete of non-existent file", async () => {
      const fm = await createFileManager(createTestConfig(testDir));
      await expect(fm.deleteFile({ slug: "uploads", name: "nope.txt" })).rejects.toBeInstanceOf(
        FileNotFoundError,
      );
    });
  });

  describe("Zip integration", () => {
    it("creates zip archive on upload", async () => {
      const fm = await createFileManager(
        createTestConfig(testDir, {
          slugs: {
            docs: {
              path: "docs",
              zip: { enabled: true, keepOriginal: true },
            },
          },
        }),
      );

      const file = createTestFile("zip me", "readme.txt");
      const result = await fm.uploadFile("docs", file);
      expect(result.success).toBe(true);
      expect(result.variants?.zip).toBeDefined();

      // Verify zip file exists on disk
      const zipPath = path.join(testDir, "docs", result.variants!.zip!);
      const exists = await fs
        .stat(zipPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });
});
