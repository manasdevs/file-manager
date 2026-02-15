import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { randomBytes } from "node:crypto";
import type { ManasFmConfig } from "../types/config.js";
import type { FileInput } from "../types/common.js";

/** Create a temp directory for a test suite */
export async function createTestDir(): Promise<string> {
  const dir = path.join(os.tmpdir(), `manasfm-test-${randomBytes(8).toString("hex")}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/** Create a minimal valid ManasFmConfig pointing to the test dir */
export function createTestConfig(
  testDir: string,
  overrides?: Partial<ManasFmConfig>,
): ManasFmConfig {
  return {
    basePath: testDir,
    slugs: {
      uploads: {
        path: "uploads",
      },
    },
    ...overrides,
  };
}

/** Create a FileInput from a string (for simple test data) */
export function createTestFile(
  content: string = "test file content",
  name: string = "test.txt",
  mimeType: string = "text/plain",
): FileInput {
  const buffer = Buffer.from(content);
  return {
    buffer,
    originalName: name,
    mimeType,
    size: buffer.length,
  };
}

/** Clean up a test directory */
export async function cleanTestDir(testDir: string): Promise<void> {
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}
