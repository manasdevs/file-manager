import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { detectProject } from "../utils/detect-project.js";
import { detectPackageManager, getInstallCommand } from "../utils/package-manager.js";
import { writeFileSafe, ensureDir } from "../utils/fs.js";
import { gatherUserConfig } from "../prompts/gather-config.js";
import { generateFileManagerConfig } from "../templates/file-manager-config.js";
import { generateApiRoute } from "../templates/api-route.js";
import { generateServerActions } from "../templates/server-actions.js";
import { generateUploadProgressHook } from "../templates/upload-progress-hook.js";
import { generateLlmsTxt } from "../templates/llms-txt.js";
import { step, success, info, warn, error, outro, blank, section, code } from "../utils/logger.js";
import styles from "ansi-styles";

import type { CloudStorageInput, StorageProvider } from "../types.js";

const bold = (text: string) => `${styles.bold.open}${text}${styles.bold.close}`;
const cyan = (text: string) => `${styles.cyan.open}${text}${styles.cyan.close}`;
const dim = (text: string) => `${styles.dim.open}${text}${styles.dim.close}`;
const underline = (text: string) => `${styles.underline.open}${text}${styles.underline.close}`;
const magenta = (text: string) => `${styles.magenta.open}${text}${styles.magenta.close}`;

export async function runInit() {
  const cwd = process.cwd();

  // ── Step 1: Detect project ──
  section("📦 Project Detection");
  step("Detecting project...");
  const project = detectProject();
  const pm = detectPackageManager();
  info(`Package manager: ${bold(pm)}`);
  blank();

  // ── Step 2: Gather configuration from user ──
  section("⚙️  Configuration");
  const config = await gatherUserConfig(project);
  blank();

  // ── Step 3: Install manas-fm package ──
  section("📥 Installation");
  step("Installing manas-fm...");
  const installCmd = getInstallCommand(pm, "manas-fm");
  try {
    execSync(installCmd, { cwd, stdio: "pipe" });
    success("Installed manas-fm");
  } catch {
    warn(`Could not auto-install. Please run: ${code(installCmd)}`);
  }
  blank();

  // ── Step 3b: Install cloud SDK dependencies ──
  const isCloud = config.storageProvider !== "local";
  if (isCloud && config.cloudStorage) {
    const cloudDeps = getCloudDependencies(config.cloudStorage.provider);
    if (cloudDeps.length > 0) {
      step(`Installing cloud storage dependencies: ${cloudDeps.join(", ")}...`);
      const cloudInstallCmd = getInstallCommand(pm, cloudDeps.join(" "));
      try {
        execSync(cloudInstallCmd, { cwd, stdio: "pipe" });
        success(`Installed ${cloudDeps.join(", ")}`);
      } catch {
        warn(`Could not auto-install. Please run: ${code(cloudInstallCmd)}`);
      }
    }
    blank();
  }

  // ── Step 4: Create storage directory (local only) ──
  section("📁 Storage Setup");
  if (isCloud) {
    info(`Cloud storage provider: ${bold(config.storageProvider)}`);
    info(`Files will be stored in your cloud bucket/container.`);

    // Generate .env.example with cloud credentials
    step("Generating .env.example with cloud credentials...");
    const envExample = generateEnvExample(config.cloudStorage!);
    const envExamplePath = path.join(cwd, ".env.example");
    writeFileSafe(envExamplePath, envExample);
    success("Created .env.example with cloud storage placeholders");
  } else {
    step("Creating storage directory...");
    const storagePath = path.resolve(cwd, config.storagePath);
    ensureDir(storagePath);

    // Create sub-directories for each slug
    for (const slug of config.slugs) {
      ensureDir(path.join(storagePath, slug.path));
    }
    success(`Storage directory: ${config.storagePath}`);

    // Create .gitkeep in storage
    writeFileSafe(path.join(storagePath, ".gitkeep"), "");
  }

  blank();

  // ── Step 5: Generate lib/file-manager config ──
  section("🔧 Code Generation");
  step("Generating file manager configuration...");
  const ext = project.isTypeScript ? "ts" : "js";
  const libDir = project.srcDir ? path.join(cwd, "src", "lib") : path.join(cwd, "lib");

  const configContent = generateFileManagerConfig(config, project.isTypeScript);
  writeFileSafe(path.join(libDir, `file-manager.${ext}`), configContent);

  // Determine the import alias for lib/file-manager
  const aliasImport = project.srcDir ? "@/lib/file-manager" : "../lib/file-manager";

  // ── Step 6: Generate Next.js files ──
  if (project.framework === "nextjs" && project.appRouter) {
    if (config.setupApiRoute) {
      step("Generating API route handler...");
      const apiDir = project.srcDir
        ? path.join(cwd, "src", "app", "api", "files", "[...all]")
        : path.join(cwd, "app", "api", "files", "[...all]");

      const apiContent = generateApiRoute(project.isTypeScript, aliasImport);
      writeFileSafe(path.join(apiDir, `route.${ext}`), apiContent);
    }

    if (config.setupServerActions) {
      step("Generating server actions...");
      const actionsDir = project.srcDir ? path.join(cwd, "src", "app") : path.join(cwd, "app");

      const actionsContent = generateServerActions(project.isTypeScript, aliasImport);
      writeFileSafe(path.join(actionsDir, `actions.${ext}`), actionsContent);
    }

    if (config.setupUploadProgress) {
      step("Generating upload progress hook...");
      const hookDir = project.srcDir ? path.join(cwd, "src", "app") : path.join(cwd, "app");

      const hookContent = generateUploadProgressHook(project.isTypeScript);
      writeFileSafe(path.join(hookDir, `use-upload-progress.${ext}`), hookContent);
    }
  }

  // ── Step 6b: Generate llms.txt documentation ──
  step("Generating llms.txt documentation...");
  const llmsDir = path.join(cwd, "docs", "llms");
  const llmsContent = generateLlmsTxt();
  writeFileSafe(path.join(llmsDir, "manas-fm.llms.txt"), llmsContent);
  success(`Documentation: docs/llms/manas-fm.llms.txt`);

  // ── Step 7: Add storage to .gitignore (local only) ──
  if (!isCloud) {
    step("Updating .gitignore...");
    addToGitignore(cwd, config.storagePath);
  }

  // ── Done ──
  outro();
  printNextSteps(config, project, pm);
}

function addToGitignore(cwd: string, storagePath: string) {
  const gitignorePath = path.join(cwd, ".gitignore");
  const entry = storagePath.replace(/^\.\//, "") + "/";

  try {
    let content = "";
    if (fs.existsSync(gitignorePath)) {
      content = fs.readFileSync(gitignorePath, "utf-8");
    }

    if (!content.includes(entry)) {
      const addition = `\n# manas-fm storage\n${entry}\n!${entry}.gitkeep\n`;
      fs.appendFileSync(gitignorePath, addition);
      success("Updated .gitignore");
    } else {
      info(".gitignore already has storage entry");
    }
  } catch {
    warn(`Could not update .gitignore. Please add "${entry}" manually.`);
  }
}

function printNextSteps(
  config: Awaited<ReturnType<typeof gatherUserConfig>>,
  project: ReturnType<typeof detectProject>,
  pm: string,
) {
  blank();
  console.log(bold(magenta("  🚀 Next Steps")));
  console.log(dim("  " + "─".repeat(40)));
  console.log();

  let stepNum = 1;

  if (project.framework === "nextjs") {
    console.log(dim(`  ${stepNum}.`) + " " + bold("Import and use the file manager:"));
    console.log(cyan(`     import { getFileManager } from "@/lib/file-manager";`));
    console.log(cyan(`     const fm = await getFileManager();`));
    stepNum++;

    if (config.setupApiRoute) {
      console.log(
        dim(`  ${stepNum}.`) +
          " " +
          bold("API routes are ready at") +
          " " +
          magenta("/api/files/*"),
      );
      stepNum++;
    }

    if (config.setupServerActions) {
      console.log(
        dim(`  ${stepNum}.`) +
          " " +
          bold("Server actions ready in") +
          " " +
          magenta("app/actions.ts"),
      );
      stepNum++;
    }

    if (config.setupUploadProgress) {
      console.log(
        dim(`  ${stepNum}.`) +
          " " +
          bold("Upload progress hook ready:") +
          " " +
          magenta("useUploadProgress()"),
      );
      console.log(cyan(`     import { useUploadProgress } from "./use-upload-progress";`));
      console.log(cyan(`     const { upload, percent, phase } = useUploadProgress();`));
      stepNum++;
    }
  } else {
    console.log(dim(`  ${stepNum}.`) + " " + bold("Import and use the file manager:"));
    console.log(cyan(`     import { createFileManager } from "manas-fm";`));
    console.log(cyan(`     import { getFileManager } from "./lib/file-manager";`));
    stepNum++;
  }

  console.log(
    dim(`  ${stepNum}.`) +
      " " +
      bold("Available slugs:") +
      " " +
      config.slugs.map((s) => magenta(s.name)).join(dim(", ")),
  );
  stepNum++;

  if (config.storageProvider !== "local") {
    console.log(
      dim(`  ${stepNum}.`) +
        " " +
        bold("Cloud storage:") +
        " " +
        magenta(config.storageProvider) +
        dim(" — copy .env.example → .env and fill in credentials"),
    );
    stepNum++;
  }

  console.log(
    dim(`  ${stepNum}.`) + " " + bold("LLM docs at") + " " + magenta("docs/llms/manas-fm.llms.txt"),
  );
  stepNum++;

  console.log(
    dim(`  ${stepNum}.`) +
      " " +
      bold("Read the docs:") +
      " " +
      underline("https://github.com/manasdevs/file-manager#readme"),
  );
  console.log();
}

function getCloudDependencies(provider: string): string[] {
  const s3Providers = [
    "aws",
    "gcs",
    "digitalocean-spaces",
    "backblaze",
    "wasabi",
    "minio",
    "cloudflare",
    "oracle",
    "ibm",
    "supabase",
  ];

  if (s3Providers.includes(provider)) {
    return ["@aws-sdk/client-s3", "@aws-sdk/lib-storage"];
  }
  if (provider === "azure") {
    return ["@azure/storage-blob"];
  }
  if (provider === "firebase") {
    return ["firebase-admin"];
  }
  return [];
}

function generateEnvExample(cloudStorage: CloudStorageInput): string {
  const lines: string[] = [
    "# ──────────────────────────────────────────────",
    "# Cloud Storage Credentials (manas-fm)",
    "# ──────────────────────────────────────────────",
    "",
  ];

  const s3Providers = [
    "aws",
    "gcs",
    "digitalocean-spaces",
    "backblaze",
    "wasabi",
    "minio",
    "cloudflare",
    "oracle",
    "ibm",
    "supabase",
  ];

  if (s3Providers.includes(cloudStorage.provider)) {
    lines.push(`# S3-compatible storage (${cloudStorage.provider})`);
    lines.push(`S3_ACCESS_KEY_ID=your-access-key-id`);
    lines.push(`S3_SECRET_ACCESS_KEY=your-secret-access-key`);
    if (cloudStorage.bucket) {
      lines.push(`# Bucket: ${cloudStorage.bucket}`);
    }
    if (cloudStorage.region) {
      lines.push(`# Region: ${cloudStorage.region}`);
    }
  } else if (cloudStorage.provider === "azure") {
    lines.push(`# Azure Blob Storage`);
    lines.push(
      `AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net`,
    );
    if (cloudStorage.containerName) {
      lines.push(`# Container: ${cloudStorage.containerName}`);
    }
  } else if (cloudStorage.provider === "firebase") {
    lines.push(`# Firebase Storage`);
    lines.push(`GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json`);
    if (cloudStorage.firebaseBucket) {
      lines.push(`# Bucket: ${cloudStorage.firebaseBucket}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}
