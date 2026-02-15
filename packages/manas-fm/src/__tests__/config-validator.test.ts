import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { validateConfig } from "../core/config-validator.js";
import { ConfigError } from "../errors/config-error.js";

describe("config-validator", () => {
  const basePath = "/tmp/manasfm-test-config";

  it("validates a minimal valid config", async () => {
    const config = await validateConfig({
      basePath,
      slugs: { uploads: { path: "uploads" } },
    });

    expect(config.basePath).toBe(path.resolve(basePath));
    expect(config.slugs.uploads.path).toBe(path.resolve(basePath, "uploads"));
    expect(config.slugs.uploads.allowedTypes).toEqual([]);
    expect(config.slugs.uploads.maxSizeBytes).toBe(Infinity);
    expect(config.slugs.uploads.retentionDays).toBeNull();
    expect(config.slugs.uploads.versioning.enabled).toBe(false);
    expect(config.slugs.uploads.compression).toBeNull();
    expect(config.slugs.uploads.zip).toBeNull();
  });

  it("throws on missing basePath", async () => {
    await expect(
      validateConfig({ basePath: "", slugs: { a: { path: "a" } } }),
    ).rejects.toBeInstanceOf(ConfigError);
  });

  it("throws on missing slugs", async () => {
    await expect(validateConfig({ basePath, slugs: {} })).rejects.toBeInstanceOf(ConfigError);
  });

  it("throws on slug with missing path", async () => {
    await expect(validateConfig({ basePath, slugs: { bad: { path: "" } } })).rejects.toBeInstanceOf(
      ConfigError,
    );
  });

  it("throws on negative maxSizeBytes", async () => {
    await expect(
      validateConfig({ basePath, slugs: { a: { path: "a", maxSizeBytes: -1 } } }),
    ).rejects.toBeInstanceOf(ConfigError);
  });

  it("throws on negative retentionDays", async () => {
    await expect(
      validateConfig({ basePath, slugs: { a: { path: "a", retentionDays: -5 } } }),
    ).rejects.toBeInstanceOf(ConfigError);
  });

  it("throws on invalid compression quality", async () => {
    await expect(
      validateConfig({
        basePath,
        slugs: {
          a: {
            path: "a",
            compression: { enabled: true, keepOriginal: true, quality: 150 },
          },
        },
      }),
    ).rejects.toBeInstanceOf(ConfigError);
  });

  it("merges global versioning defaults", async () => {
    const config = await validateConfig({
      basePath,
      versioning: { enabledByDefault: true, maxVersions: 5 },
      slugs: { uploads: { path: "uploads" } },
    });

    expect(config.slugs.uploads.versioning.enabled).toBe(true);
    expect(config.slugs.uploads.versioning.maxVersions).toBe(5);
  });

  it("slug-level versioning overrides global", async () => {
    const config = await validateConfig({
      basePath,
      versioning: { enabledByDefault: true, maxVersions: 10 },
      slugs: {
        uploads: {
          path: "uploads",
          versioning: { enabled: false, maxVersions: 3 },
        },
      },
    });

    expect(config.slugs.uploads.versioning.enabled).toBe(false);
    expect(config.slugs.uploads.versioning.maxVersions).toBe(3);
  });

  it("resolves logging defaults", async () => {
    const config = await validateConfig({
      basePath,
      slugs: { uploads: { path: "uploads" } },
    });

    expect(config.logging.enabled).toBe(false);
    expect(config.logging.level).toBe("info");
  });

  it("resolves cleanup defaults", async () => {
    const config = await validateConfig({
      basePath,
      slugs: { uploads: { path: "uploads" } },
    });

    expect(config.cleanup.enabled).toBe(false);
    expect(config.cleanup.intervalHours).toBe(24);
  });

  it("resolves zip config", async () => {
    const config = await validateConfig({
      basePath,
      slugs: {
        docs: {
          path: "docs",
          zip: { enabled: true, keepOriginal: true },
        },
      },
    });

    expect(config.slugs.docs.zip).toEqual({
      enabled: true,
      keepOriginal: true,
      outputPath: "archive",
    });
  });
});
