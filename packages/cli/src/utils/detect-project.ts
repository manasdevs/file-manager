import * as fs from "node:fs";
import * as path from "node:path";

export type Framework = "nextjs" | "node";

export interface ProjectInfo {
  framework: Framework;
  isTypeScript: boolean;
  srcDir: boolean;
  appRouter: boolean; // Next.js App Router
  packageJsonPath: string;
}

export function detectProject(): ProjectInfo {
  const cwd = process.cwd();
  const packageJsonPath = path.join(cwd, "package.json");

  if (!fs.existsSync(packageJsonPath)) {
    throw new Error("No package.json found. Please run this command in a Node.js project root.");
  }

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  const hasNext = "next" in allDeps;
  const framework: Framework = hasNext ? "nextjs" : "node";

  const isTypeScript = fs.existsSync(path.join(cwd, "tsconfig.json")) || "typescript" in allDeps;

  const srcDir = fs.existsSync(path.join(cwd, "src"));

  // Detect App Router vs Pages Router for Next.js
  let appRouter = false;
  if (hasNext) {
    const appDir = srcDir ? path.join(cwd, "src", "app") : path.join(cwd, "app");
    appRouter = fs.existsSync(appDir);
  }

  return {
    framework,
    isTypeScript,
    srcDir,
    appRouter,
    packageJsonPath,
  };
}
