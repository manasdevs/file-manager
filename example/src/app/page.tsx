"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  listFiles,
  getFileInfo,
  deleteFile,
  updateFile,
  renameFile,
  moveFile,
  duplicateFile,
} from "./actions";
import { useUploadProgress } from "./use-upload-progress";
import styles from "./page.module.css";

interface FileListItem {
  name: string;
  path: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

const SLUGS = ["images", "documents", "uploads"] as const;

function getFileIconClass(mimeType: string): string {
  if (mimeType.startsWith("image/")) return styles.fileIconImg;
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("text") ||
    mimeType.includes("json") ||
    mimeType.includes("html") ||
    mimeType.includes("css")
  )
    return styles.fileIconDoc;
  return styles.fileIcon;
}

function getFileEmoji(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "\u{1F5BC}";
  if (mimeType.includes("pdf")) return "\u{1F4C4}";
  if (mimeType.includes("json")) return "\u{1F4CB}";
  if (mimeType.includes("text") || mimeType.includes("html") || mimeType.includes("css"))
    return "\u{1F4DD}";
  return "\u{1F4CE}";
}

export default function Home() {
  const [activeSlug, setActiveSlug] = useState<string>("images");
  const [files, setFiles] = useState<FileListItem[]>([]);
  const [result, setResult] = useState<string>("");
  const [resultIsError, setResultIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateFileRef = useRef<HTMLInputElement>(null);

  // Upload progress hook
  const {
    percent: uploadPercent,
    phase: uploadPhase,
    phaseLabel: uploadPhaseLabel,
    isUploading,
    error: uploadError,
    result: uploadResult,
    upload: startUpload,
    reset: resetUpload,
  } = useUploadProgress();

  // When the hook finishes (success or error), update UI
  useEffect(() => {
    if (uploadResult) {
      showResult(uploadResult);
      refreshFiles(activeSlug);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [uploadResult]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (uploadError) {
      showResult({ error: uploadError }, true);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [uploadError]); // eslint-disable-line react-hooks/exhaustive-deps

  const showResult = (data: unknown, isError = false) => {
    setResult(JSON.stringify(data, null, 2));
    setResultIsError(isError);
  };

  const refreshFiles = useCallback(async (slug: string) => {
    try {
      const res = await listFiles(slug);
      if (res.success) {
        setFiles(res.data);
      } else {
        showResult({ error: res.error }, true);
      }
    } catch (err) {
      showResult({ error: err instanceof Error ? err.message : String(err) }, true);
    }
  }, []);

  const handleSlugChange = (slug: string) => {
    setActiveSlug(slug);
    setSelectedFile(null);
    refreshFiles(slug);
  };

  const doUpload = (file: File) => {
    resetUpload();
    startUpload(file, activeSlug, { overwrite });
  };

  const handleUpload = () => {
    const file = selectedFile || fileInputRef.current?.files?.[0];
    if (!file) return;
    doUpload(file);
  };

  const handleFileSelect = () => {
    const file = fileInputRef.current?.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      doUpload(file);
    }
  };

  const handleDownload = (name: string) => {
    window.open(
      `/api/files/download?slug=${activeSlug}&name=${encodeURIComponent(name)}`,
      "_blank",
    );
  };

  const handleInfo = async (name: string) => {
    try {
      const res = await getFileInfo(activeSlug, name);
      showResult(res.success ? res.data : { error: res.error }, !res.success);
    } catch (err) {
      showResult({ error: err instanceof Error ? err.message : String(err) }, true);
    }
  };

  const handleDelete = async (name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;

    try {
      const res = await deleteFile(activeSlug, name);
      showResult(res.success ? res.data : { error: res.error }, !res.success);
      if (res.success) refreshFiles(activeSlug);
    } catch (err) {
      showResult({ error: err instanceof Error ? err.message : String(err) }, true);
    }
  };

  const handleRename = async (name: string) => {
    const newName = window.prompt(`Rename "${name}" to:`, name);
    if (!newName || newName === name) return;

    try {
      const res = await renameFile(activeSlug, name, newName);
      showResult(res.success ? res.data : { error: res.error }, !res.success);
      if (res.success) refreshFiles(activeSlug);
    } catch (err) {
      showResult({ error: err instanceof Error ? err.message : String(err) }, true);
    }
  };

  const handleMove = async (name: string) => {
    const targetSlug = window.prompt(
      `Move "${name}" to which slug? (${SLUGS.join(", ")})`,
      activeSlug,
    );
    if (!targetSlug) return;

    try {
      const res = await moveFile(activeSlug, name, targetSlug);
      showResult(res.success ? res.data : { error: res.error }, !res.success);
      if (res.success) refreshFiles(activeSlug);
    } catch (err) {
      showResult({ error: err instanceof Error ? err.message : String(err) }, true);
    }
  };

  const handleDuplicate = async (name: string) => {
    try {
      const res = await duplicateFile(activeSlug, name);
      showResult(res.success ? res.data : { error: res.error }, !res.success);
      if (res.success) refreshFiles(activeSlug);
    } catch (err) {
      showResult({ error: err instanceof Error ? err.message : String(err) }, true);
    }
  };

  const handleUpdate = async (name: string) => {
    const input = updateFileRef.current;
    if (!input) return;

    input.onchange = async () => {
      if (!input.files?.[0]) return;

      setLoading(true);
      try {
        const formData = new FormData();
        formData.append("file", input.files[0]);
        formData.append("slug", activeSlug);
        formData.append("name", name);

        const res = await updateFile(formData);
        showResult(res.success ? res.data : { error: res.error }, !res.success);
        if (res.success) refreshFiles(activeSlug);
      } catch (err) {
        showResult({ error: err instanceof Error ? err.message : String(err) }, true);
      } finally {
        setLoading(false);
        input.value = "";
      }
    };
    input.click();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.title}>manas-fm</h1>
        <p className={styles.subtitle}>
          File management dashboard &mdash; upload, organize, version, and download files across
          storage buckets.
        </p>
      </header>

      {/* Slug Tabs */}
      <div className={styles.tabs}>
        {SLUGS.map((slug) => (
          <button
            key={slug}
            onClick={() => handleSlugChange(slug)}
            className={activeSlug === slug ? styles.tabActive : styles.tab}
          >
            {slug}
          </button>
        ))}
      </div>

      {/* Upload Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Upload</h2>
        </div>

        <div
          className={dragging ? styles.uploadZoneDrag : styles.uploadZone}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <span className={styles.uploadIcon}>{dragging ? "\u{1F4E5}" : "\u{2601}\u{FE0F}"}</span>
          <p className={styles.uploadText}>
            Drag & drop a file here, or <span className={styles.uploadTextBrowse}>browse</span>
          </p>
          <p className={styles.uploadHint}>
            Upload to <strong>{activeSlug}</strong> bucket
          </p>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className={styles.hiddenInput}
        />

        <div className={styles.uploadActions}>
          {selectedFile && (
            <span className={styles.selectedFile}>
              <span className={styles.selectedFileName}>{selectedFile.name}</span>
              <span>({formatSize(selectedFile.size)})</span>
            </span>
          )}

          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
            />
            Overwrite
          </label>

          <button
            onClick={handleUpload}
            disabled={isUploading || !selectedFile}
            className={styles.btnPrimary}
          >
            {isUploading ? (
              <>
                <span className={styles.spinnerWhite} /> Uploading...
              </>
            ) : (
              "Upload"
            )}
          </button>
        </div>

        {/* Upload Progress Bar */}
        {isUploading && (
          <div className={styles.progressContainer}>
            <div className={styles.progressBarTrack}>
              <div className={styles.progressBarFill} style={{ width: `${uploadPercent}%` }} />
            </div>
            <div className={styles.progressInfo}>
              <span className={styles.progressLabel}>{uploadPhaseLabel}</span>
              <span className={styles.progressPercent}>{uploadPercent}%</span>
            </div>
          </div>
        )}
      </div>

      {/* File List Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            Files in <span className={styles.cardTitleCode}>{activeSlug}</span>
          </h2>
          <button onClick={() => refreshFiles(activeSlug)} className={styles.btn}>
            Refresh
          </button>
        </div>

        {files.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>{"\u{1F4C2}"}</span>
            <p className={styles.emptyTitle}>No files yet</p>
            <p className={styles.emptyHint}>
              Upload a file or click Refresh to load existing files.
            </p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Name</th>
                  <th className={styles.th}>Size</th>
                  <th className={styles.th}>Type</th>
                  <th className={styles.th}>Created</th>
                  <th className={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.name} className={styles.tr}>
                    <td className={styles.td}>
                      <span className={styles.fileName}>
                        <span className={getFileIconClass(file.mimeType)}>
                          {getFileEmoji(file.mimeType)}
                        </span>
                        {file.name}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.fileSize}>{formatSize(file.size)}</span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.badge}>{file.mimeType.split("/")[1]}</span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.fileDate}>{formatDate(file.createdAt)}</span>
                    </td>
                    <td className={styles.td}>
                      <div className={styles.actions}>
                        <button
                          onClick={() => handleInfo(file.name)}
                          className={`${styles.btn} ${styles.btnSmall}`}
                        >
                          Info
                        </button>
                        <button
                          onClick={() => handleDownload(file.name)}
                          className={`${styles.btn} ${styles.btnSmall}`}
                        >
                          Download
                        </button>
                        <button
                          onClick={() => handleUpdate(file.name)}
                          className={`${styles.btn} ${styles.btnSmall}`}
                        >
                          Update
                        </button>
                        <button
                          onClick={() => handleRename(file.name)}
                          className={`${styles.btn} ${styles.btnSmall}`}
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => handleMove(file.name)}
                          className={`${styles.btn} ${styles.btnSmall}`}
                        >
                          Move
                        </button>
                        <button
                          onClick={() => handleDuplicate(file.name)}
                          className={`${styles.btn} ${styles.btnSmall}`}
                        >
                          Duplicate
                        </button>
                        <button
                          onClick={() => handleDelete(file.name)}
                          className={`${styles.btnDanger} ${styles.btnSmall}`}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hidden file input for update */}
      <input type="file" ref={updateFileRef} className={styles.hiddenInput} />

      {/* Result Panel */}
      {result && (
        <div className={resultIsError ? styles.resultPanelError : styles.resultPanel}>
          <div className={styles.resultHeader}>
            <h3 className={resultIsError ? styles.resultTitleError : styles.resultTitleSuccess}>
              {resultIsError ? "Error" : "Success"}
            </h3>
            <button onClick={() => setResult("")} className={`${styles.btn} ${styles.btnSmall}`}>
              Dismiss
            </button>
          </div>
          <pre className={styles.codeBlock}>{result}</pre>
        </div>
      )}
    </div>
  );
}
