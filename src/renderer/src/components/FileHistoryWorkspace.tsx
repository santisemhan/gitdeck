import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { FileHistoryEntry } from "../../../shared/types";
import type { ChangedFile, DiffMode } from "../data/types";
import { gitClient } from "../services/gitClient";
import { formatRelativeTime } from "../utils/date";
import { DiffPreviewWorkspace } from "./DiffPreviewWorkspace";
import { IconX } from "./icons";

// ─── helpers ─────────────────────────────────────────────────────────────────

function authorInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// Deterministic hue from a string (used for avatar background)
function stringHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return hash % 360;
}

// Build a minimal ChangedFile so DiffPreviewWorkspace can work with file history entries
function toChangedFile(filePath: string): ChangedFile {
  const parts = filePath.split("/");
  const name = parts[parts.length - 1];
  return {
    id: filePath,
    path: filePath,
    status: "modified",
    additions: 0,
    deletions: 0,
    oldText: "",
    newText: "",
    renamedFrom: undefined,
  } as ChangedFile & { renamedFrom?: string };
}

// ─── sub-components ──────────────────────────────────────────────────────────

interface CommitItemProps {
  entry: FileHistoryEntry;
  selected: boolean;
  onSelect: () => void;
}

function CommitItem({ entry, selected, onSelect }: CommitItemProps) {
  const { commit } = entry;
  const hue = stringHue(commit.authorEmail || commit.authorName);

  return (
    <button
      className={`fh-commit-item${selected ? " selected" : ""}`}
      onClick={onSelect}
      title={commit.subject}
    >
      <div
        className="fh-commit-avatar"
        style={{ background: `hsl(${hue} 55% 42%)` }}
        aria-hidden="true"
      >
        {authorInitials(commit.authorName)}
      </div>

      <div className="fh-commit-info">
        <span className="fh-commit-subject">{commit.subject}</span>
        <span className="fh-commit-meta">
          <span className="fh-commit-hash">{commit.shortHash}</span>
          <span className="fh-commit-sep">·</span>
          <span className="fh-commit-date">{formatRelativeTime(commit.date, { invalid: commit.date })}</span>
          <span className="fh-commit-sep">by</span>
          <span className="fh-commit-author">{commit.authorName}</span>
        </span>
      </div>
    </button>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 100;

interface FileHistoryWorkspaceProps {
  repoPath: string;
  filePath: string;
  diffMode: DiffMode;
  onChangeDiffMode: (mode: DiffMode) => void;
  onClose: () => void;
}

export function FileHistoryWorkspace({
  repoPath,
  filePath,
  diffMode,
  onChangeDiffMode,
  onClose,
}: FileHistoryWorkspaceProps) {
  const [entries, setEntries] = useState<FileHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<FileHistoryEntry | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const doneRef = useRef(false);
  const entriesRef = useRef<FileHistoryEntry[]>([]);

  // Keep refs in sync so the IntersectionObserver callback always has fresh values
  useEffect(() => { entriesRef.current = entries; }, [entries]);
  useEffect(() => { doneRef.current = done; }, [done]);

  const loadPage = useCallback(async (isInitial = false) => {
    if (loadingRef.current || doneRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const skip = isInitial ? 0 : entriesRef.current.length;
      const page = await gitClient.fileHistory(repoPath, filePath, { limit: PAGE_SIZE, skip });
      const merged = isInitial ? page : [...entriesRef.current, ...page];
      entriesRef.current = merged;
      if (page.length === 0 || page.length < PAGE_SIZE) {
        setDone(true);
        doneRef.current = true;
      }
      // Select the first entry automatically on the very first load
      if (isInitial && page.length > 0) {
        setSelectedEntry(page[0]);
      }
      setEntries(merged);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load file history");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [repoPath, filePath]);

  // Initial load — only depends on repoPath/filePath, NOT loadPage
  useEffect(() => {
    setEntries([]);
    setDone(false);
    setSelectedEntry(null);
    entriesRef.current = [];
    doneRef.current = false;
    loadingRef.current = false;
    void loadPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath, filePath]);

  // Sentinel-based lazy load for pagination
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (observerEntries) => {
        if (observerEntries[0]?.isIntersecting && !loadingRef.current && !doneRef.current) {
          void loadPage(false);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadPage]);

  // Build ChangedFile from the selected entry's pathAtCommit
  const diffFile = selectedEntry ? toChangedFile(selectedEntry.pathAtCommit) : null;

  return (
    <div className="fh-workspace">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="fh-header">
        <span className="fh-header-title">
          <span className="fh-header-label">File History:</span>
          <span className="fh-header-path" title={filePath}>{filePath}</span>
        </span>
        <button className="fh-header-close" onClick={onClose} title="Close file history (Esc)">
          <IconX size={14} />
        </button>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="fh-body">
        {/* Commit list */}
        <div className="fh-commit-list" role="list">
          {entries.length === 0 && !loading && (
            <div className="fh-empty">No history found for this file.</div>
          )}

          {entries.map((entry) => (
            <CommitItem
              key={entry.commit.hash}
              entry={entry}
              selected={selectedEntry?.commit.hash === entry.commit.hash}
              onSelect={() => setSelectedEntry(entry)}
            />
          ))}

          {/* Sentinel for lazy load */}
          {!done && (
            <div ref={sentinelRef} className="fh-sentinel">
              {loading && <span className="fh-loading-text">Loading…</span>}
            </div>
          )}
        </div>

        {/* Diff panel */}
        <div className="fh-diff-panel">
          {diffFile && selectedEntry ? (
            <DiffPreviewWorkspace
              key={`${selectedEntry.commit.hash}-${selectedEntry.pathAtCommit}`}
              repoPath={repoPath}
              file={diffFile}
              source="commit"
              commitHash={selectedEntry.commit.hash}
              diffMode={diffMode}
              onChangeDiffMode={onChangeDiffMode}
              hideHistoryButton
            />
          ) : (
            <div className="fh-diff-placeholder">
              {loading ? "Loading history…" : "Select a commit to view changes."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
