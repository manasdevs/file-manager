/**
 * Generate the useUploadProgress React hook for client-side upload with progress tracking.
 *
 * This hook uses XHR for network transfer progress (0–50%)
 * and streaming NDJSON parsing for server processing progress (50–100%).
 */
export function generateUploadProgressHook(isTypeScript: boolean): string {
  const lines: string[] = [];

  lines.push(`"use client";`);
  lines.push(``);
  lines.push(`import { useState, useCallback, useRef } from "react";`);
  lines.push(``);

  // Types
  if (isTypeScript) {
    lines.push(`/** Server-side upload phases */`);
    lines.push(`export type UploadPhase =`);
    lines.push(`  | "idle"`);
    lines.push(`  | "uploading"`);
    lines.push(`  | "validating"`);
    lines.push(`  | "writing"`);
    lines.push(`  | "zipping"`);
    lines.push(`  | "compressing"`);
    lines.push(`  | "saving-metadata"`);
    lines.push(`  | "complete"`);
    lines.push(`  | "error";`);
    lines.push(``);
  }

  // Phase labels
  lines.push(
    `const PHASE_LABELS${isTypeScript ? `: Record<${isTypeScript ? "UploadPhase" : "string"}, string>` : ""} = {`,
  );
  lines.push(`  idle: "",`);
  lines.push(`  uploading: "Uploading...",`);
  lines.push(`  validating: "Validating file...",`);
  lines.push(`  writing: "Writing to disk...",`);
  lines.push(`  zipping: "Creating zip archive...",`);
  lines.push(`  compressing: "Compressing image...",`);
  lines.push(`  "saving-metadata": "Saving metadata...",`);
  lines.push(`  complete: "Upload complete!",`);
  lines.push(`  error: "Upload failed",`);
  lines.push(`};`);
  lines.push(``);

  if (isTypeScript) {
    lines.push(`interface UploadProgressState {`);
    lines.push(`  percent: number;`);
    lines.push(`  phase: UploadPhase;`);
    lines.push(`  phaseLabel: string;`);
    lines.push(`  isUploading: boolean;`);
    lines.push(`  error: string | null;`);
    lines.push(`  result: unknown | null;`);
    lines.push(`}`);
    lines.push(``);
    lines.push(`interface UseUploadProgressReturn extends UploadProgressState {`);
    lines.push(
      `  upload: (file: File, slug: string, options?: { subPath?: string; overwrite?: boolean }) => void;`,
    );
    lines.push(`  reset: () => void;`);
    lines.push(`}`);
    lines.push(``);
  }

  // Hook
  lines.push(`/**`);
  lines.push(` * React hook for upload progress tracking at two levels:`);
  lines.push(` * 1. Network transfer (0–50%): Tracks bytes sent via XMLHttpRequest`);
  lines.push(` * 2. Server processing (50–100%): Reads streaming NDJSON progress from the server`);
  lines.push(` *`);
  lines.push(` * @param endpoint - The upload API endpoint (default: "/api/files/upload")`);
  lines.push(` */`);

  if (isTypeScript) {
    lines.push(
      `export function useUploadProgress(endpoint = "/api/files/upload"): UseUploadProgressReturn {`,
    );
    lines.push(`  const [state, setState] = useState<UploadProgressState>({`);
  } else {
    lines.push(`export function useUploadProgress(endpoint = "/api/files/upload") {`);
    lines.push(`  const [state, setState] = useState({`);
  }
  lines.push(`    percent: 0,`);
  lines.push(`    phase: "idle",`);
  lines.push(`    phaseLabel: "",`);
  lines.push(`    isUploading: false,`);
  lines.push(`    error: null,`);
  lines.push(`    result: null,`);
  lines.push(`  });`);
  lines.push(``);

  if (isTypeScript) {
    lines.push(`  const abortRef = useRef<XMLHttpRequest | null>(null);`);
  } else {
    lines.push(`  const abortRef = useRef(null);`);
  }
  lines.push(``);

  // reset
  lines.push(`  const reset = useCallback(() => {`);
  lines.push(`    if (abortRef.current) {`);
  lines.push(`      abortRef.current.abort();`);
  lines.push(`      abortRef.current = null;`);
  lines.push(`    }`);
  lines.push(`    setState({`);
  lines.push(`      percent: 0,`);
  lines.push(`      phase: "idle",`);
  lines.push(`      phaseLabel: "",`);
  lines.push(`      isUploading: false,`);
  lines.push(`      error: null,`);
  lines.push(`      result: null,`);
  lines.push(`    });`);
  lines.push(`  }, []);`);
  lines.push(``);

  // upload
  if (isTypeScript) {
    lines.push(`  const upload = useCallback(`);
    lines.push(
      `    (file: File, slug: string, options?: { subPath?: string; overwrite?: boolean }) => {`,
    );
  } else {
    lines.push(`  const upload = useCallback(`);
    lines.push(`    (file, slug, options) => {`);
  }
  lines.push(`      setState({`);
  lines.push(`        percent: 0,`);
  lines.push(`        phase: "uploading",`);
  lines.push(`        phaseLabel: PHASE_LABELS.uploading,`);
  lines.push(`        isUploading: true,`);
  lines.push(`        error: null,`);
  lines.push(`        result: null,`);
  lines.push(`      });`);
  lines.push(``);
  lines.push(`      const formData = new FormData();`);
  lines.push(`      formData.append("file", file);`);
  lines.push(`      formData.append("slug", slug);`);
  lines.push(`      if (options?.subPath) formData.append("subPath", options.subPath);`);
  lines.push(`      if (options?.overwrite) formData.append("overwrite", "true");`);
  lines.push(``);
  lines.push(`      const xhr = new XMLHttpRequest();`);
  lines.push(`      abortRef.current = xhr;`);
  lines.push(``);

  // Network progress
  lines.push(`      // Phase 1: Network transfer progress (0–50%)`);
  lines.push(`      xhr.upload.addEventListener("progress", (e) => {`);
  lines.push(`        if (e.lengthComputable) {`);
  lines.push(`          const networkPercent = Math.round((e.loaded / e.total) * 50);`);
  lines.push(`          setState((prev) => ({`);
  lines.push(`            ...prev,`);
  lines.push(`            percent: networkPercent,`);
  lines.push(`            phase: "uploading",`);
  lines.push(`            phaseLabel: PHASE_LABELS.uploading,`);
  lines.push(`          }));`);
  lines.push(`        }`);
  lines.push(`      });`);
  lines.push(``);
  lines.push(`      xhr.upload.addEventListener("load", () => {`);
  lines.push(`        setState((prev) => ({`);
  lines.push(`          ...prev,`);
  lines.push(`          percent: 50,`);
  lines.push(`          phase: "validating",`);
  lines.push(`          phaseLabel: "Processing on server...",`);
  lines.push(`        }));`);
  lines.push(`      });`);
  lines.push(``);

  // Server progress (NDJSON)
  lines.push(`      // Phase 2: Parse streaming NDJSON for server progress (50–100%)`);
  lines.push(`      let responseText = "";`);
  lines.push(`      let processedLength = 0;`);
  lines.push(``);
  lines.push(`      xhr.addEventListener("progress", () => {`);
  lines.push(`        responseText = xhr.responseText;`);
  lines.push(`        const newData = responseText.slice(processedLength);`);
  lines.push(`        processedLength = responseText.length;`);
  lines.push(``);
  lines.push(`        const lines = newData.split("\\n").filter((l) => l.trim());`);
  lines.push(`        for (const line of lines) {`);
  lines.push(`          try {`);
  lines.push(`            const event = JSON.parse(line);`);
  lines.push(`            if (event.type === "progress") {`);
  lines.push(`              const serverPercent = 50 + Math.round((event.percent / 100) * 50);`);
  if (isTypeScript) {
    lines.push(`              const phase = event.phase as UploadPhase;`);
  } else {
    lines.push(`              const phase = event.phase;`);
  }
  lines.push(`              setState((prev) => ({`);
  lines.push(`                ...prev,`);
  lines.push(`                percent: serverPercent,`);
  lines.push(`                phase,`);
  lines.push(
    `                phaseLabel: event.message || PHASE_LABELS[phase] || "Processing...",`,
  );
  lines.push(`              }));`);
  lines.push(`            } else if (event.type === "result") {`);
  lines.push(`              setState({`);
  lines.push(`                percent: 100,`);
  lines.push(`                phase: "complete",`);
  lines.push(`                phaseLabel: PHASE_LABELS.complete,`);
  lines.push(`                isUploading: false,`);
  lines.push(`                error: null,`);
  lines.push(`                result: event.data,`);
  lines.push(`              });`);
  lines.push(`            } else if (event.type === "error") {`);
  lines.push(`              setState({`);
  lines.push(`                percent: 0,`);
  lines.push(`                phase: "error",`);
  lines.push(`                phaseLabel: PHASE_LABELS.error,`);
  lines.push(`                isUploading: false,`);
  lines.push(`                error: event.error,`);
  lines.push(`                result: null,`);
  lines.push(`              });`);
  lines.push(`            }`);
  lines.push(`          } catch {`);
  lines.push(`            // Incomplete JSON line – ignore`);
  lines.push(`          }`);
  lines.push(`        }`);
  lines.push(`      });`);
  lines.push(``);

  // Error/abort/load fallback
  lines.push(`      xhr.addEventListener("error", () => {`);
  lines.push(`        setState({`);
  lines.push(`          percent: 0,`);
  lines.push(`          phase: "error",`);
  lines.push(`          phaseLabel: PHASE_LABELS.error,`);
  lines.push(`          isUploading: false,`);
  lines.push(`          error: "Network error during upload",`);
  lines.push(`          result: null,`);
  lines.push(`        });`);
  lines.push(`      });`);
  lines.push(``);
  lines.push(`      xhr.addEventListener("abort", () => {`);
  lines.push(`        setState({`);
  lines.push(`          percent: 0,`);
  lines.push(`          phase: "idle",`);
  lines.push(`          phaseLabel: "",`);
  lines.push(`          isUploading: false,`);
  lines.push(`          error: null,`);
  lines.push(`          result: null,`);
  lines.push(`        });`);
  lines.push(`      });`);
  lines.push(``);

  // Fallback for non-streaming responses
  lines.push(`      // Fallback for non-streaming JSON response`);
  lines.push(`      xhr.addEventListener("load", () => {`);
  lines.push(`        setState((prev) => {`);
  lines.push(`          if (prev.phase === "complete" || prev.phase === "error") return prev;`);
  lines.push(`          try {`);
  lines.push(`            const data = JSON.parse(xhr.responseText);`);
  lines.push(`            if (xhr.status >= 200 && xhr.status < 300) {`);
  lines.push(`              return {`);
  lines.push(`                percent: 100,`);
  lines.push(`                phase: "complete",`);
  lines.push(`                phaseLabel: PHASE_LABELS.complete,`);
  lines.push(`                isUploading: false,`);
  lines.push(`                error: null,`);
  lines.push(`                result: data,`);
  lines.push(`              };`);
  lines.push(`            }`);
  lines.push(`            return {`);
  lines.push(`              percent: 0,`);
  lines.push(`              phase: "error",`);
  lines.push(`              phaseLabel: PHASE_LABELS.error,`);
  lines.push(`              isUploading: false,`);
  lines.push(`              error: data.error || \`Upload failed (\${xhr.status})\`,`);
  lines.push(`              result: null,`);
  lines.push(`            };`);
  lines.push(`          } catch {`);
  lines.push(`            return {`);
  lines.push(`              percent: 0,`);
  lines.push(`              phase: "error",`);
  lines.push(`              phaseLabel: PHASE_LABELS.error,`);
  lines.push(`              isUploading: false,`);
  lines.push(`              error: \`Upload failed (\${xhr.status})\`,`);
  lines.push(`              result: null,`);
  lines.push(`            };`);
  lines.push(`          }`);
  lines.push(`        });`);
  lines.push(`      });`);
  lines.push(``);

  lines.push(`      xhr.open("POST", endpoint);`);
  lines.push(`      xhr.setRequestHeader("Accept", "text/event-stream");`);
  lines.push(`      xhr.send(formData);`);
  lines.push(`    },`);
  lines.push(`    [endpoint],`);
  lines.push(`  );`);
  lines.push(``);
  lines.push(`  return {`);
  lines.push(`    ...state,`);
  lines.push(`    upload,`);
  lines.push(`    reset,`);
  lines.push(`  };`);
  lines.push(`}`);
  lines.push(``);

  return lines.join("\n");
}
