"use client";

import { useState, useCallback, useRef } from "react";

/** Server-side upload phases */
export type UploadPhase =
  | "idle"
  | "uploading" // network transfer in progress
  | "validating"
  | "writing"
  | "zipping"
  | "compressing"
  | "saving-metadata"
  | "complete"
  | "error";

const PHASE_LABELS: Record<UploadPhase, string> = {
  idle: "",
  uploading: "Uploading...",
  validating: "Validating file...",
  writing: "Writing to disk...",
  zipping: "Creating zip archive...",
  compressing: "Compressing image...",
  "saving-metadata": "Saving metadata...",
  complete: "Upload complete!",
  error: "Upload failed",
};

interface UploadProgressState {
  /** Overall progress 0–100 */
  percent: number;
  /** Current phase of the upload */
  phase: UploadPhase;
  /** Human-readable label for the current phase */
  phaseLabel: string;
  /** Whether an upload is in progress */
  isUploading: boolean;
  /** Error message if upload failed */
  error: string | null;
  /** The final upload result (server response) */
  result: unknown | null;
}

interface UseUploadProgressReturn extends UploadProgressState {
  /**
   * Start uploading a file. Uses XHR for network progress tracking
   * and streams server-side processing progress via NDJSON.
   */
  upload: (file: File, slug: string, options?: { subPath?: string; overwrite?: boolean }) => void;
  /** Reset the state back to idle */
  reset: () => void;
}

/**
 * React hook that provides upload progress tracking at two levels:
 *
 * 1. **Network transfer** (0–50%): Tracks bytes sent to the server via XMLHttpRequest
 * 2. **Server processing** (50–100%): Reads streaming NDJSON progress events from the
 *    server (validating → writing → zipping → compressing → saving-metadata → complete)
 *
 * @param endpoint - The upload API endpoint (default: "/api/files/upload")
 */
export function useUploadProgress(endpoint = "/api/files/upload"): UseUploadProgressReturn {
  const [state, setState] = useState<UploadProgressState>({
    percent: 0,
    phase: "idle",
    phaseLabel: "",
    isUploading: false,
    error: null,
    result: null,
  });

  const abortRef = useRef<XMLHttpRequest | null>(null);

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setState({
      percent: 0,
      phase: "idle",
      phaseLabel: "",
      isUploading: false,
      error: null,
      result: null,
    });
  }, []);

  const upload = useCallback(
    (file: File, slug: string, options?: { subPath?: string; overwrite?: boolean }) => {
      // Reset previous state
      setState({
        percent: 0,
        phase: "uploading",
        phaseLabel: PHASE_LABELS.uploading,
        isUploading: true,
        error: null,
        result: null,
      });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("slug", slug);
      if (options?.subPath) formData.append("subPath", options.subPath);
      if (options?.overwrite) formData.append("overwrite", "true");

      const xhr = new XMLHttpRequest();
      abortRef.current = xhr;

      // ── Phase 1: Network transfer progress (0–50%) ──
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const networkPercent = Math.round((e.loaded / e.total) * 50);
          setState((prev) => ({
            ...prev,
            percent: networkPercent,
            phase: "uploading",
            phaseLabel: PHASE_LABELS.uploading,
          }));
        }
      });

      xhr.upload.addEventListener("load", () => {
        // All bytes sent – waiting for server processing
        setState((prev) => ({
          ...prev,
          percent: 50,
          phase: "validating",
          phaseLabel: "Processing on server...",
        }));
      });

      // ── Phase 2: Parse streaming NDJSON response for server progress (50–100%) ──
      let responseText = "";
      let processedLength = 0;

      xhr.addEventListener("progress", () => {
        responseText = xhr.responseText;
        const newData = responseText.slice(processedLength);
        processedLength = responseText.length;

        // Parse complete NDJSON lines
        const lines = newData.split("\n").filter((l) => l.trim());
        for (const line of lines) {
          try {
            const event = JSON.parse(line);

            if (event.type === "progress") {
              // Map server percent (0-100) to our 50-100 range
              const serverPercent = 50 + Math.round((event.percent / 100) * 50);
              const phase = event.phase as UploadPhase;
              setState((prev) => ({
                ...prev,
                percent: serverPercent,
                phase,
                phaseLabel: event.message || PHASE_LABELS[phase] || "Processing...",
              }));
            } else if (event.type === "result") {
              setState({
                percent: 100,
                phase: "complete",
                phaseLabel: PHASE_LABELS.complete,
                isUploading: false,
                error: null,
                result: event.data,
              });
            } else if (event.type === "error") {
              setState({
                percent: 0,
                phase: "error",
                phaseLabel: PHASE_LABELS.error,
                isUploading: false,
                error: event.error,
                result: null,
              });
            }
          } catch {
            // Incomplete JSON line – ignore, will be completed on next progress event
          }
        }
      });

      xhr.addEventListener("error", () => {
        setState({
          percent: 0,
          phase: "error",
          phaseLabel: PHASE_LABELS.error,
          isUploading: false,
          error: "Network error during upload",
          result: null,
        });
      });

      xhr.addEventListener("abort", () => {
        setState({
          percent: 0,
          phase: "idle",
          phaseLabel: "",
          isUploading: false,
          error: null,
          result: null,
        });
      });

      // If we don't get a streaming response (e.g. server doesn't support it),
      // handle the final load event as a fallback
      xhr.addEventListener("load", () => {
        // If already in complete or error state from streaming, skip
        setState((prev) => {
          if (prev.phase === "complete" || prev.phase === "error") return prev;

          // Fallback: parse the full response as JSON
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              return {
                percent: 100,
                phase: "complete" as const,
                phaseLabel: PHASE_LABELS.complete,
                isUploading: false,
                error: null,
                result: data,
              };
            }
            return {
              percent: 0,
              phase: "error" as const,
              phaseLabel: PHASE_LABELS.error,
              isUploading: false,
              error: data.error || `Upload failed (${xhr.status})`,
              result: null,
            };
          } catch {
            return {
              percent: 0,
              phase: "error" as const,
              phaseLabel: PHASE_LABELS.error,
              isUploading: false,
              error: `Upload failed (${xhr.status})`,
              result: null,
            };
          }
        });
      });

      xhr.open("POST", endpoint);
      xhr.setRequestHeader("Accept", "text/event-stream");
      xhr.send(formData);
    },
    [endpoint],
  );

  return {
    ...state,
    upload,
    reset,
  };
}
