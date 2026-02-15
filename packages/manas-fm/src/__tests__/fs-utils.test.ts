import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import {
  atomicWriteFile,
  ensureDirectory,
  safeDeleteFile,
  copyFile,
  moveFile,
  readFileBuffer,
  fileExists,
  directoryExists,
  generateUniqueName,
  wrapFsError,
} from "../core/fs-utils.js";
import { FileNotFoundError } from "../errors/file-not-found-error.js";
import { StorageError } from "../errors/storage-error.js";
import { createTestDir, cleanTestDir } from "./helpers.js";

describe("fs-utils", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await cleanTestDir(testDir);
  });

  describe("atomicWriteFile", () => {
    it("creates a file with correct content", async () => {
      const filePath = path.join(testDir, "test.txt");
      await atomicWriteFile(filePath, "hello world");
      const content = await fs.readFile(filePath, "utf-8");
      expect(content).toBe("hello world");
    });

    it("writes buffer content", async () => {
      const filePath = path.join(testDir, "binary.bin");
      const buf = Buffer.from([0x01, 0x02, 0x03]);
      await atomicWriteFile(filePath, buf);
      const content = await fs.readFile(filePath);
      expect(Buffer.compare(content, buf)).toBe(0);
    });

    it("overwrites existing file", async () => {
      const filePath = path.join(testDir, "overwrite.txt");
      await atomicWriteFile(filePath, "first");
      await atomicWriteFile(filePath, "second");
      const content = await fs.readFile(filePath, "utf-8");
      expect(content).toBe("second");
    });
  });

  describe("ensureDirectory", () => {
    it("creates nested directories", async () => {
      const dir = path.join(testDir, "a", "b", "c");
      await ensureDirectory(dir);
      expect(await directoryExists(dir)).toBe(true);
    });

    it("does not throw if directory exists", async () => {
      await ensureDirectory(testDir);
    });
  });

  describe("safeDeleteFile", () => {
    it("deletes existing file and returns true", async () => {
      const filePath = path.join(testDir, "delete-me.txt");
      await fs.writeFile(filePath, "data");
      expect(await safeDeleteFile(filePath)).toBe(true);
      expect(await fileExists(filePath)).toBe(false);
    });

    it("returns false for non-existent file", async () => {
      expect(await safeDeleteFile(path.join(testDir, "nope.txt"))).toBe(false);
    });
  });

  describe("copyFile", () => {
    it("copies a file", async () => {
      const src = path.join(testDir, "src.txt");
      const dest = path.join(testDir, "sub", "dest.txt");
      await fs.writeFile(src, "copy me");
      await copyFile(src, dest);
      const content = await fs.readFile(dest, "utf-8");
      expect(content).toBe("copy me");
    });
  });

  describe("moveFile", () => {
    it("moves a file", async () => {
      const src = path.join(testDir, "move-src.txt");
      const dest = path.join(testDir, "moved", "move-dest.txt");
      await fs.writeFile(src, "move me");
      await moveFile(src, dest);
      expect(await fileExists(src)).toBe(false);
      expect(await fileExists(dest)).toBe(true);
      const content = await fs.readFile(dest, "utf-8");
      expect(content).toBe("move me");
    });
  });

  describe("readFileBuffer", () => {
    it("reads file into buffer", async () => {
      const filePath = path.join(testDir, "read-me.txt");
      await fs.writeFile(filePath, "buffer content");
      const buffer = await readFileBuffer(filePath);
      expect(buffer.toString()).toBe("buffer content");
    });

    it("throws FileNotFoundError for missing file", async () => {
      await expect(readFileBuffer(path.join(testDir, "nope.txt"))).rejects.toBeInstanceOf(
        FileNotFoundError,
      );
    });
  });

  describe("fileExists / directoryExists", () => {
    it("returns true for existing file", async () => {
      const filePath = path.join(testDir, "exists.txt");
      await fs.writeFile(filePath, "yes");
      expect(await fileExists(filePath)).toBe(true);
    });

    it("returns false for non-existent file", async () => {
      expect(await fileExists(path.join(testDir, "nope.txt"))).toBe(false);
    });

    it("returns true for existing directory", async () => {
      expect(await directoryExists(testDir)).toBe(true);
    });

    it("returns false for non-existent directory", async () => {
      expect(await directoryExists(path.join(testDir, "nope"))).toBe(false);
    });
  });

  describe("generateUniqueName", () => {
    it("returns original name if no conflict", () => {
      expect(generateUniqueName("photo.jpg", new Set())).toBe("photo.jpg");
    });

    it("appends -1 on first conflict", () => {
      expect(generateUniqueName("photo.jpg", new Set(["photo.jpg"]))).toBe("photo-1.jpg");
    });

    it("increments counter on multiple conflicts", () => {
      expect(
        generateUniqueName("photo.jpg", new Set(["photo.jpg", "photo-1.jpg", "photo-2.jpg"])),
      ).toBe("photo-3.jpg");
    });

    it("handles files without extension", () => {
      expect(generateUniqueName("Makefile", new Set(["Makefile"]))).toBe("Makefile-1");
    });
  });

  describe("wrapFsError", () => {
    it("maps ENOENT to FileNotFoundError", () => {
      const err = Object.assign(new Error("no entry"), { code: "ENOENT" });
      const wrapped = wrapFsError(err, "test");
      expect(wrapped).toBeInstanceOf(FileNotFoundError);
    });

    it("maps EACCES to PermissionError", () => {
      const err = Object.assign(new Error("access denied"), { code: "EACCES" });
      const wrapped = wrapFsError(err, "test");
      expect(wrapped.code).toBe("PERMISSION_ERROR");
    });

    it("maps ENOSPC to StorageError", () => {
      const err = Object.assign(new Error("no space"), { code: "ENOSPC" });
      const wrapped = wrapFsError(err, "test");
      expect(wrapped).toBeInstanceOf(StorageError);
    });

    it("maps unknown errors to StorageError", () => {
      const wrapped = wrapFsError(new Error("unknown"), "test");
      expect(wrapped).toBeInstanceOf(StorageError);
    });
  });
});
