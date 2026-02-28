import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Readable } from "node:stream";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { byteaPack, byteaUnpack, BYTEA_PACK_VERSION } from "../bytea/index.js";
import type { ByteaPackInput, ByteaManifest } from "../bytea/types.js";
import { createFileManager } from "../create-file-manager.js";
import { ValidationError } from "../errors/validation-error.js";
import { OperationError } from "../errors/operation-error.js";
import { createTestDir, cleanTestDir, createTestConfig, createTestFile } from "./helpers.js";

// ---------------------------------------------------------------------------
// Standalone byteaPack / byteaUnpack
// ---------------------------------------------------------------------------

describe("byteaPack / byteaUnpack — standalone", () => {
  // ── Round-trip ──────────────────────────────────────────────────────────

  it("should round-trip a buffer to a packed buffer and back", async () => {
    const original = Buffer.from("hello bytea world");
    const packed = await byteaPack({
      source: original,
      filename: "greeting.txt",
      mimeType: "text/plain",
    });

    expect(packed.buffer).toBeInstanceOf(Buffer);
    expect(packed.packedSize).toBeGreaterThan(0);
    expect(packed.originalSize).toBe(original.length);
    expect(packed.manifest.filename).toBe("greeting.txt");
    expect(packed.manifest.mimeType).toBe("text/plain");
    expect(packed.manifest.version).toBe(BYTEA_PACK_VERSION);

    const unpacked = await byteaUnpack(packed.buffer);
    expect(unpacked.buffer).toEqual(original);
    expect(unpacked.manifest.filename).toBe("greeting.txt");
    expect(unpacked.manifest.mimeType).toBe("text/plain");
    expect(unpacked.manifest.originalSize).toBe(original.length);
  });

  // ── Pack from file path ────────────────────────────────────────────────

  describe("pack from file path", () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = await createTestDir();
    });

    afterEach(async () => {
      await cleanTestDir(testDir);
    });

    it("should pack a file read from disk path", async () => {
      const content = "data read from disk";
      const filePath = path.join(testDir, "disk-file.txt");
      await fs.writeFile(filePath, content);

      const packed = await byteaPack({
        source: filePath,
        filename: "disk-file.txt",
        mimeType: "text/plain",
      });

      expect(packed.originalSize).toBe(Buffer.from(content).length);

      const unpacked = await byteaUnpack(packed.buffer);
      expect(unpacked.buffer.toString()).toBe(content);
    });

    it("should throw OperationError when file path does not exist", async () => {
      await expect(
        byteaPack({
          source: path.join(testDir, "nonexistent.txt"),
          filename: "nonexistent.txt",
          mimeType: "text/plain",
        }),
      ).rejects.toBeInstanceOf(OperationError);
    });
  });

  // ── Pack from Readable stream ──────────────────────────────────────────

  it("should pack from a Readable stream", async () => {
    const content = "streamed content";
    const stream = Readable.from(Buffer.from(content));

    const packed = await byteaPack({
      source: stream,
      filename: "stream-file.txt",
      mimeType: "text/plain",
    });

    const unpacked = await byteaUnpack(packed.buffer);
    expect(unpacked.buffer.toString()).toBe(content);
  });

  // ── Manifest integrity ─────────────────────────────────────────────────

  it("should embed correct manifest fields", async () => {
    const before = new Date().toISOString();

    const packed = await byteaPack({
      source: Buffer.from("manifest test"),
      filename: "report.pdf",
      mimeType: "application/pdf",
    });

    const after = new Date().toISOString();
    const m = packed.manifest;

    expect(m.version).toBe(1);
    expect(m.filename).toBe("report.pdf");
    expect(m.mimeType).toBe("application/pdf");
    expect(m.originalSize).toBe(Buffer.from("manifest test").length);
    expect(m.createdAt >= before).toBe(true);
    expect(m.createdAt <= after).toBe(true);
    expect(m.packedAt >= before).toBe(true);
    expect(m.packedAt <= after).toBe(true);
    expect(m.slug).toBeUndefined(); // standalone — no slug
  });

  // ── Custom metadata ────────────────────────────────────────────────────

  it("should preserve custom metadata through round-trip", async () => {
    const custom = { userId: 42, tags: ["a", "b"] };

    const packed = await byteaPack(
      { source: Buffer.from("x"), filename: "x.bin", mimeType: "application/octet-stream" },
      { custom },
    );

    expect(packed.manifest.custom).toEqual(custom);

    const unpacked = await byteaUnpack(packed.buffer);
    expect(unpacked.manifest.custom).toEqual(custom);
  });

  it("should merge input.custom and options.custom (options wins on conflict)", async () => {
    const packed = await byteaPack(
      {
        source: Buffer.from("x"),
        filename: "x.bin",
        mimeType: "application/octet-stream",
        custom: { a: 1, shared: "input" },
      },
      { custom: { b: 2, shared: "options" } },
    );

    expect(packed.manifest.custom).toEqual({ a: 1, b: 2, shared: "options" });
  });

  // ── Compression ────────────────────────────────────────────────────────

  it("should compress redundant data (packed < original)", async () => {
    const redundant = Buffer.alloc(10_000, "a"); // very compressible

    const packed = await byteaPack({
      source: redundant,
      filename: "big.txt",
      mimeType: "text/plain",
    });

    expect(packed.packedSize).toBeLessThan(packed.originalSize);
  });

  it("should respect compressionLevel option", async () => {
    const data = Buffer.alloc(5_000, "abcdefghij");

    const [noCompression, maxCompression] = await Promise.all([
      byteaPack(
        { source: data, filename: "a.bin", mimeType: "application/octet-stream" },
        { compressionLevel: 0 },
      ),
      byteaPack(
        { source: data, filename: "a.bin", mimeType: "application/octet-stream" },
        { compressionLevel: 9 },
      ),
    ]);

    // Level 0 should produce a larger (or equal) pack than level 9
    expect(noCompression.packedSize).toBeGreaterThanOrEqual(maxCompression.packedSize);
  });

  // ── Validation errors (pack) ───────────────────────────────────────────

  it("should throw ValidationError when filename is missing", async () => {
    await expect(
      byteaPack({
        source: Buffer.from("x"),
        filename: "",
        mimeType: "text/plain",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("should throw ValidationError when mimeType is missing", async () => {
    await expect(
      byteaPack({
        source: Buffer.from("x"),
        filename: "x.txt",
        mimeType: "",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("should throw ValidationError when source is null", async () => {
    await expect(
      byteaPack({
        source: null as any,
        filename: "x.txt",
        mimeType: "text/plain",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("should throw ValidationError for invalid compressionLevel", async () => {
    await expect(
      byteaPack(
        { source: Buffer.from("x"), filename: "x.txt", mimeType: "text/plain" },
        { compressionLevel: 10 },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  // ── Validation errors (unpack) ─────────────────────────────────────────

  it("should throw ValidationError for empty buffer", async () => {
    await expect(byteaUnpack(Buffer.alloc(0))).rejects.toBeInstanceOf(ValidationError);
  });

  it("should throw OperationError for non-ZIP buffer", async () => {
    await expect(byteaUnpack(Buffer.from("not a zip"))).rejects.toBeInstanceOf(OperationError);
  });

  // ── Binary fidelity ────────────────────────────────────────────────────

  it("should preserve binary data without base64 encoding overhead", async () => {
    // Create random binary data
    const binaryData = Buffer.alloc(256);
    for (let i = 0; i < 256; i++) binaryData[i] = i;

    const packed = await byteaPack({
      source: binaryData,
      filename: "binary.bin",
      mimeType: "application/octet-stream",
    });

    const unpacked = await byteaUnpack(packed.buffer);
    expect(unpacked.buffer).toEqual(binaryData);
    expect(unpacked.buffer.length).toBe(256);
  });
});

// ---------------------------------------------------------------------------
// FileManager integration — fm.byteaPack / fm.byteaUnpack
// ---------------------------------------------------------------------------

describe("FileManager byteaPack / byteaUnpack", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await cleanTestDir(testDir);
  });

  it("should pack via FileManager with slug validation", async () => {
    const fm = await createFileManager(
      createTestConfig(testDir, {
        slugs: {
          documents: {
            path: "documents",
            allowedTypes: ["text/plain", "application/pdf"],
            maxSizeBytes: 10 * 1024 * 1024,
          },
        },
      }),
    );

    const file = createTestFile("document content", "doc.txt", "text/plain");
    const packed = await fm.byteaPack("documents", file);

    expect(packed.manifest.slug).toBe("documents");
    expect(packed.manifest.filename).toBe("doc.txt");
    expect(packed.manifest.mimeType).toBe("text/plain");

    // Verify unpacking
    const unpacked = await fm.byteaUnpack(packed.buffer);
    expect(unpacked.buffer.toString()).toBe("document content");
    expect(unpacked.manifest.slug).toBe("documents");
  });

  it("should accept ByteaPackInput directly", async () => {
    const fm = await createFileManager(
      createTestConfig(testDir, {
        slugs: {
          uploads: { path: "uploads" },
        },
      }),
    );

    const input: ByteaPackInput = {
      source: Buffer.from("raw input"),
      filename: "raw.bin",
      mimeType: "application/octet-stream",
    };

    const packed = await fm.byteaPack("uploads", input);
    expect(packed.manifest.slug).toBe("uploads");
    expect(packed.manifest.filename).toBe("raw.bin");
  });

  it("should throw ValidationError for unknown slug", async () => {
    const fm = await createFileManager(createTestConfig(testDir));
    const file = createTestFile();

    await expect(fm.byteaPack("nonexistent", file)).rejects.toBeInstanceOf(ValidationError);
  });

  it("should throw ValidationError for disallowed MIME type", async () => {
    const fm = await createFileManager(
      createTestConfig(testDir, {
        slugs: {
          images: {
            path: "images",
            allowedTypes: ["image/*"],
          },
        },
      }),
    );

    const file = createTestFile("not an image", "file.txt", "text/plain");
    await expect(fm.byteaPack("images", file)).rejects.toBeInstanceOf(ValidationError);
  });

  it("should throw ValidationError when file exceeds maxSizeBytes", async () => {
    const fm = await createFileManager(
      createTestConfig(testDir, {
        slugs: {
          tiny: {
            path: "tiny",
            maxSizeBytes: 5,
          },
        },
      }),
    );

    const file = createTestFile("this content is way too long", "big.txt", "text/plain");
    await expect(fm.byteaPack("tiny", file)).rejects.toBeInstanceOf(ValidationError);
  });

  it("should allow wildcard MIME type matching", async () => {
    const fm = await createFileManager(
      createTestConfig(testDir, {
        slugs: {
          images: {
            path: "images",
            allowedTypes: ["image/*"],
          },
        },
      }),
    );

    const file = createTestFile("img data", "photo.png", "image/png");
    const packed = await fm.byteaPack("images", file);
    expect(packed.manifest.mimeType).toBe("image/png");
  });
});
