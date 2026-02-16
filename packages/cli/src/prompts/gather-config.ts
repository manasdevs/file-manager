import prompts from "prompts";
import type { SlugInput, UserConfig } from "../types.js";
import type { ProjectInfo } from "../utils/detect-project.js";
import { info, blank, step, warn } from "../utils/logger.js";
import styles from "ansi-styles";

const bold = (text: string) => `${styles.bold.open}${text}${styles.bold.close}`;
const magenta = (text: string) => `${styles.magenta.open}${text}${styles.magenta.close}`;

const COMMON_PRESETS: Record<string, Omit<SlugInput, "name">> = {
  images: {
    path: "images",
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    maxSizeMB: 10,
    enableCompression: true,
    compressionFormat: "webp",
    compressionQuality: 75,
    enableZip: false,
  },
  documents: {
    path: "documents",
    allowedTypes: [
      "application/pdf",
      "text/plain",
      "application/json",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    maxSizeMB: 25,
    enableCompression: false,
    enableZip: true,
    retentionDays: 90,
  },
  uploads: {
    path: "uploads",
    allowedTypes: [],
    maxSizeMB: 50,
    enableCompression: false,
    enableZip: false,
  },
  avatars: {
    path: "avatars",
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    maxSizeMB: 5,
    enableCompression: true,
    compressionFormat: "webp",
    compressionQuality: 80,
    enableZip: false,
  },
  videos: {
    path: "videos",
    allowedTypes: ["video/mp4", "video/webm", "video/quicktime"],
    maxSizeMB: 100,
    enableCompression: false,
    enableZip: false,
  },
};

function onCancel() {
  throw new Error("PROMPT_CANCELLED");
}

export async function gatherUserConfig(project: ProjectInfo): Promise<UserConfig> {
  info(
    `Detected: ${bold(magenta(project.framework === "nextjs" ? "Next.js" : "Node.js"))} project`,
  );
  if (project.isTypeScript) info(`TypeScript: ${bold(magenta("✓"))}`);
  if (project.srcDir) info(`src/ directory: ${bold(magenta("✓"))}`);
  if (project.appRouter) info(`App Router: ${bold(magenta("✓"))}`);
  blank();

  // ── Storage path ──
  const { storagePath } = await prompts(
    {
      type: "text",
      name: "storagePath",
      message: "Where should files be stored?",
      initial: "./storage",
    },
    { onCancel },
  );

  // ── Logging ──
  const { enableLogging } = await prompts(
    {
      type: "confirm",
      name: "enableLogging",
      message: "Enable logging?",
      initial: true,
    },
    { onCancel },
  );

  let logLevel: UserConfig["logLevel"] = "info";
  if (enableLogging) {
    const res = await prompts(
      {
        type: "select",
        name: "logLevel",
        message: "Log level:",
        choices: [
          { title: "debug", value: "debug" },
          { title: "info", value: "info" },
          { title: "warn", value: "warn" },
          { title: "error", value: "error" },
        ],
        initial: 1,
      },
      { onCancel },
    );
    logLevel = res.logLevel;
  }

  // ── Versioning ──
  const { enableVersioning } = await prompts(
    {
      type: "confirm",
      name: "enableVersioning",
      message: "Enable file versioning by default?",
      initial: false,
    },
    { onCancel },
  );

  let maxVersions = 5;
  if (enableVersioning) {
    const res = await prompts(
      {
        type: "number",
        name: "maxVersions",
        message: "Max versions to keep per file:",
        initial: 5,
        min: 1,
        max: 50,
      },
      { onCancel },
    );
    maxVersions = res.maxVersions;
  }

  // ── File Naming Strategy ──
  const { fileNaming } = await prompts(
    {
      type: "select",
      name: "fileNaming",
      message: "Default file naming strategy:",
      choices: [
        { title: "original        — Keep original filename (photo.jpg)", value: "original" },
        { title: "uuid            — Random UUID (a1b2c3d4-...-.jpg)", value: "uuid" },
        { title: "name-uuid       — Name + short UUID (photo-a1b2c3d4.jpg)", value: "name-uuid" },
        {
          title: "name-number     — Name + counter (photo-1.jpg, photo-2.jpg)",
          value: "name-number",
        },
        {
          title: "name-timestamp  — Name + timestamp (photo-20260217-103000.jpg)",
          value: "name-timestamp",
        },
        { title: "timestamp       — Timestamp only (20260217-103000.jpg)", value: "timestamp" },
      ],
      initial: 0,
    },
    { onCancel },
  );

  // ── Slugs (upload categories) ──
  blank();
  step("Configure upload categories (slugs)");
  info("Slugs define different types of uploads with separate rules.");
  blank();

  const { slugMethod } = await prompts(
    {
      type: "select",
      name: "slugMethod",
      message: "How would you like to configure slugs?",
      choices: [
        { title: "Use presets (images, documents, uploads)", value: "presets" },
        { title: "Custom — I'll define my own", value: "custom" },
        { title: "Both — start with presets, then add custom", value: "both" },
      ],
      initial: 0,
    },
    { onCancel },
  );

  const slugs: SlugInput[] = [];

  // Presets
  if (slugMethod === "presets" || slugMethod === "both") {
    const { selectedPresets } = await prompts(
      {
        type: "multiselect",
        name: "selectedPresets",
        message: "Select presets:",
        choices: Object.keys(COMMON_PRESETS).map((key) => ({
          title: key,
          value: key,
          selected: ["images", "documents", "uploads"].includes(key),
        })),
        min: 1,
      },
      { onCancel },
    );

    for (const preset of selectedPresets as string[]) {
      slugs.push({ name: preset, ...COMMON_PRESETS[preset] });
    }
  }

  // Custom slugs
  if (slugMethod === "custom" || slugMethod === "both") {
    let addMore = true;
    while (addMore) {
      const slug = await promptCustomSlug();
      if (slug) slugs.push(slug);

      const res = await prompts(
        {
          type: "confirm",
          name: "addMore",
          message: "Add another slug?",
          initial: false,
        },
        { onCancel },
      );
      addMore = res.addMore;
    }
  }

  // Ensure at least one slug
  if (slugs.length === 0) {
    warn("No slugs configured. Adding a default 'uploads' slug.");
    slugs.push({ name: "uploads", ...COMMON_PRESETS.uploads });
  }

  // ── Framework-specific setup ──
  let setupApiRoute = false;
  let setupServerActions = false;
  let setupUploadProgress = false;

  if (project.framework === "nextjs") {
    blank();
    step("Next.js integration");

    const nextSetup = await prompts(
      [
        {
          type: "confirm",
          name: "setupApiRoute",
          message: "Generate API route handler? (app/api/files/[...all]/route.ts)",
          initial: true,
        },
        {
          type: "confirm",
          name: "setupServerActions",
          message: "Generate server actions? (app/actions.ts)",
          initial: true,
        },
        {
          type: "confirm",
          name: "setupUploadProgress",
          message: "Generate upload progress hook? (useUploadProgress with progress bar support)",
          initial: true,
        },
      ],
      { onCancel },
    );
    setupApiRoute = nextSetup.setupApiRoute;
    setupServerActions = nextSetup.setupServerActions;
    setupUploadProgress = nextSetup.setupUploadProgress;
  }

  return {
    storagePath,
    enableLogging,
    logLevel,
    enableVersioning,
    maxVersions,
    fileNaming,
    slugs,
    setupApiRoute,
    setupServerActions,
    setupUploadProgress,
  };
}

async function promptCustomSlug(): Promise<SlugInput | null> {
  const { name } = await prompts(
    {
      type: "text",
      name: "name",
      message: "Slug name (e.g., avatars, invoices):",
      validate: (v) =>
        (v && /^[a-zA-Z][a-zA-Z0-9]*$/.test(v)) || "Must be a valid identifier (camelCase)",
    },
    { onCancel },
  );

  const { slugPath } = await prompts(
    {
      type: "text",
      name: "slugPath",
      message: `Storage sub-path for "${name}":`,
      initial: name
        .toLowerCase()
        .replace(/([A-Z])/g, "-$1")
        .toLowerCase(),
    },
    { onCancel },
  );

  const { allowedTypesStr } = await prompts(
    {
      type: "text",
      name: "allowedTypesStr",
      message: "Allowed MIME types (comma-separated, blank for any):",
      initial: "",
    },
    { onCancel },
  );
  const allowedTypes = allowedTypesStr
    ? allowedTypesStr
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean)
    : [];

  const { maxSizeMB } = await prompts(
    {
      type: "number",
      name: "maxSizeMB",
      message: "Max file size in MB:",
      initial: 10,
      min: 1,
    },
    { onCancel },
  );

  const { enableCompression } = await prompts(
    {
      type: "confirm",
      name: "enableCompression",
      message: "Enable image compression?",
      initial: false,
    },
    { onCancel },
  );

  let compressionFormat: SlugInput["compressionFormat"];
  let compressionQuality: number | undefined;
  if (enableCompression) {
    const compRes = await prompts(
      [
        {
          type: "select",
          name: "compressionFormat",
          message: "Compression output format:",
          choices: [
            { title: "webp", value: "webp" },
            { title: "jpeg", value: "jpeg" },
            { title: "png", value: "png" },
          ],
          initial: 0,
        },
        {
          type: "number",
          name: "compressionQuality",
          message: "Compression quality (1-100):",
          initial: 75,
          min: 1,
          max: 100,
        },
      ],
      { onCancel },
    );
    compressionFormat = compRes.compressionFormat;
    compressionQuality = compRes.compressionQuality;
  }

  const { enableZip } = await prompts(
    {
      type: "confirm",
      name: "enableZip",
      message: "Enable zip archiving?",
      initial: false,
    },
    { onCancel },
  );

  const { retentionDays } = await prompts(
    {
      type: "number",
      name: "retentionDays",
      message: "Retention days (0 for unlimited):",
      initial: 0,
      min: 0,
    },
    { onCancel },
  );

  return {
    name,
    path: slugPath,
    allowedTypes,
    maxSizeMB,
    enableCompression,
    compressionFormat,
    compressionQuality,
    enableZip,
    retentionDays: retentionDays || undefined,
  };
}
