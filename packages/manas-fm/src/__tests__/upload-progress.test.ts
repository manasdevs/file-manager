import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createFileManager } from "../create-file-manager.js";
import { createTestDir, cleanTestDir, createTestFile, createTestConfig } from "./helpers.js";
import type { UploadProgressEvent, UploadPhase } from "../types/common.js";

describe("Upload progress (onProgress)", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await cleanTestDir(testDir);
  });

  it("calls onProgress with expected phases during a basic upload", async () => {
    const fm = await createFileManager(createTestConfig(testDir));
    const file = createTestFile("some data", "progress-test.txt");

    const events: UploadProgressEvent[] = [];

    await fm.uploadFile("uploads", file, {
      onProgress: (event) => events.push({ ...event }),
    });

    // Should have at least: validating, writing, saving-metadata, complete
    const phases = events.map((e) => e.phase);
    expect(phases).toContain("validating");
    expect(phases).toContain("writing");
    expect(phases).toContain("saving-metadata");
    expect(phases).toContain("complete");

    // Should NOT include zip/compression phases since they're not enabled
    expect(phases).not.toContain("zipping");
    expect(phases).not.toContain("compressing");

    // Percentages should be monotonically increasing
    for (let i = 1; i < events.length; i++) {
      expect(events[i].percent).toBeGreaterThanOrEqual(events[i - 1].percent);
    }

    // Last event should be 100%
    expect(events[events.length - 1].percent).toBe(100);
    expect(events[events.length - 1].phase).toBe("complete");
  });

  it("includes all phases when zip and compression are enabled", async () => {
    // Note: compression needs sharp, so this test only checks that the phases are attempted.
    // Without sharp installed, compression will fail silently and the phase is still reported.
    const fm = await createFileManager(
      createTestConfig(testDir, {
        slugs: {
          uploads: {
            path: "uploads",
            zip: { enabled: true, keepOriginal: true },
            compression: {
              enabled: true,
              keepOriginal: true,
              quality: 75,
              format: "webp",
            },
          },
        },
      }),
    );

    const file = createTestFile("zip and compress me", "full-pipeline.txt", "text/plain");
    const events: UploadProgressEvent[] = [];

    await fm.uploadFile("uploads", file, {
      onProgress: (event) => events.push({ ...event }),
    });

    const phases = events.map((e) => e.phase);
    expect(phases).toContain("validating");
    expect(phases).toContain("writing");
    expect(phases).toContain("zipping");
    expect(phases).toContain("compressing");
    expect(phases).toContain("saving-metadata");
    expect(phases).toContain("complete");
  });

  it("reports progress with human-readable messages", async () => {
    const fm = await createFileManager(createTestConfig(testDir));
    const file = createTestFile("data", "msg-test.txt");

    const events: UploadProgressEvent[] = [];
    await fm.uploadFile("uploads", file, {
      onProgress: (event) => events.push({ ...event }),
    });

    // Every event should have a non-empty message
    for (const event of events) {
      expect(event.message).toBeTruthy();
      expect(typeof event.message).toBe("string");
    }
  });

  it("works normally when onProgress is not provided", async () => {
    const fm = await createFileManager(createTestConfig(testDir));
    const file = createTestFile("no callback", "no-progress.txt");

    // Should not throw
    const result = await fm.uploadFile("uploads", file);
    expect(result.success).toBe(true);
    expect(result.fileName).toBe("no-progress.txt");
  });
});
