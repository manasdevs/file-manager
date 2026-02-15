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
import { step, success, info, warn, error, outro, blank } from "../utils/logger.js";
import pc from "picocolors";

export async function runInit() {
  const cwd = process.cwd();

  // ── Step 1: Detect project ──
  step("Detecting project...");
  const project = detectProject();
  const pm = detectPackageManager();
  info(`Package manager: ${pm}`);
  blank();

  // ── Step 2: Gather configuration from user ──
  const config = await gatherUserConfig(project);
  blank();

  // ── Step 3: Install manas-fm package ──
  step("Installing manas-fm...");
  const installCmd = getInstallCommand(pm, "manas-fm");
  try {
    execSync(installCmd, { cwd, stdio: "pipe" });
    success("Installed manas-fm");
  } catch {
    warn(`Could not auto-install. Please run: ${pc.bold(installCmd)}`);
  }

  // ── Step 4: Create storage directory ──
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

  // ── Step 5: Generate lib/file-manager config ──
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
  }

  // ── Step 7: Add storage to .gitignore ──
  step("Updating .gitignore...");
  addToGitignore(cwd, config.storagePath);

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
  console.log(pc.bold("  Next steps:"));
  console.log();

  let stepNum = 1;

  if (project.framework === "nextjs") {
    console.log(pc.dim(`  ${stepNum}.`) + ` Import and use the file manager:`);
    console.log(pc.dim(`     import { getFileManager } from "@/lib/file-manager";`));
    console.log(pc.dim(`     const fm = await getFileManager();`));
    stepNum++;

    if (config.setupApiRoute) {
      console.log(pc.dim(`  ${stepNum}.`) + ` API routes are ready at /api/files/*`);
      stepNum++;
    }

    if (config.setupServerActions) {
      console.log(pc.dim(`  ${stepNum}.`) + ` Server actions ready in app/actions.ts`);
      stepNum++;
    }
  } else {
    console.log(pc.dim(`  ${stepNum}.`) + ` Import and use the file manager:`);
    console.log(pc.dim(`     import { createFileManager } from "manas-fm";`));
    console.log(pc.dim(`     import { getFileManager } from "./lib/file-manager";`));
    stepNum++;
  }

  console.log(
    pc.dim(`  ${stepNum}.`) +
      ` Available slugs: ${config.slugs.map((s) => pc.cyan(s.name)).join(", ")}`,
  );
  stepNum++;

  console.log(
    pc.dim(`  ${stepNum}.`) +
      ` Read the docs: ${pc.underline("https://github.com/manasdevs/file-manager#readme")}`,
  );
  console.log();
}
