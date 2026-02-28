import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { PathResolver } from "../core/path-resolver.js";
import type { ValidatedConfig } from "../types/config.js";
import { ValidationError } from "../errors/validation-error.js";
import { PermissionError } from "../errors/permission-error.js";

function createMockConfig(basePath: string): ValidatedConfig {
  return {
    basePath,
    storage: { provider: "local", isCloud: false, config: { provider: "local" } },
    logging: { enabled: false, level: "info", filePath: undefined },
    cleanup: { enabled: false, intervalHours: 24 },
    versioning: { enabledByDefault: false, maxVersions: 10 },
    slugs: {
      uploads: {
        path: path.join(basePath, "uploads"),
        allowedTypes: [],
        maxSizeBytes: Infinity,
        retentionDays: null,
        versioning: { enabled: false, maxVersions: 10 },
        compression: null,
        zip: null,
        fileNaming: { strategy: "original" },
      },
      images: {
        path: path.join(basePath, "images"),
        allowedTypes: ["image/jpeg"],
        maxSizeBytes: 5000000,
        retentionDays: null,
        versioning: { enabled: true, maxVersions: 5 },
        compression: {
          enabled: true,
          keepOriginal: true,
          outputPath: "compressed",
          quality: 80,
          format: "webp" as const,
        },
        zip: {
          enabled: true,
          keepOriginal: true,
          outputPath: "archive",
        },
        fileNaming: { strategy: "original" },
      },
    },
  };
}

describe("PathResolver", () => {
  const basePath = "/tmp/manasfm-test-pathresolver";
  let resolver: PathResolver;

  it("resolves string identifier", () => {
    resolver = new PathResolver(createMockConfig(basePath));
    const result = resolver.resolveFilePath(path.join(basePath, "uploads", "file.txt"));
    expect(result.absolutePath).toBe(path.join(basePath, "uploads", "file.txt"));
    expect(result.fileName).toBe("file.txt");
    expect(result.slug).toBe("uploads");
  });

  it("resolves slug-based identifier", () => {
    resolver = new PathResolver(createMockConfig(basePath));
    const result = resolver.resolveFilePath({ slug: "uploads", name: "file.txt" });
    expect(result.absolutePath).toBe(path.join(basePath, "uploads", "file.txt"));
    expect(result.slug).toBe("uploads");
  });

  it("throws on unknown slug", () => {
    resolver = new PathResolver(createMockConfig(basePath));
    expect(() => resolver.resolveFilePath({ slug: "nope", name: "file.txt" })).toThrow(
      ValidationError,
    );
  });

  it("throws on path traversal", () => {
    resolver = new PathResolver(createMockConfig(basePath));
    expect(() => resolver.resolveFilePath(path.join(basePath, "..", "etc", "passwd"))).toThrow(
      PermissionError,
    );
  });

  it("resolves folder identifier with slug", () => {
    resolver = new PathResolver(createMockConfig(basePath));
    const result = resolver.resolveFolderPath({ slug: "uploads" });
    expect(result).toBe(path.join(basePath, "uploads"));
  });

  it("resolves folder identifier with subPath", () => {
    resolver = new PathResolver(createMockConfig(basePath));
    const result = resolver.resolveFolderPath({ slug: "uploads", subPath: "sub/dir" });
    expect(result).toBe(path.join(basePath, "uploads", "sub", "dir"));
  });

  it("generates correct version path", () => {
    resolver = new PathResolver(createMockConfig(basePath));
    const result = resolver.getVersionPath("/tmp/photo.jpg", 3);
    expect(result).toBe("/tmp/photo.v3.jpg");
  });

  it("generates correct version path for file without extension", () => {
    resolver = new PathResolver(createMockConfig(basePath));
    const result = resolver.getVersionPath("/tmp/Makefile", 1);
    expect(result).toBe("/tmp/Makefile.v1");
  });

  it("generates correct compressed path", () => {
    resolver = new PathResolver(createMockConfig(basePath));
    const slugConfig = resolver.getSlugConfig("images");
    const result = resolver.getCompressedPath(
      path.join(basePath, "images", "photo.jpg"),
      slugConfig,
    );
    expect(result).toBe(path.join(basePath, "images", "compressed", "photo.webp"));
  });

  it("generates correct zip path", () => {
    resolver = new PathResolver(createMockConfig(basePath));
    const slugConfig = resolver.getSlugConfig("images");
    const result = resolver.getZipPath(path.join(basePath, "images", "photo.jpg"), slugConfig);
    expect(result).toBe(path.join(basePath, "images", "archive", "photo.jpg.zip"));
  });

  it("resolves slug from path", () => {
    resolver = new PathResolver(createMockConfig(basePath));
    expect(resolver.resolveSlugFromPath(path.join(basePath, "uploads", "file.txt"))).toBe(
      "uploads",
    );
    expect(resolver.resolveSlugFromPath(path.join(basePath, "other", "file.txt"))).toBeNull();
  });
});
