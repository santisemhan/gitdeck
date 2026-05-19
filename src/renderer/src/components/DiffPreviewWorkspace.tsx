import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ChangedFile, DiffMode, SelectedFileSource } from "../data/types";
import { splitPath } from "../data/mock";
import { gitClient } from "../services/gitClient";
import { parseUnifiedDiff, tokenize, type DiffHunk } from "../utils/diff";
import { FileStatusIcon } from "./FileStatusIcon";
import {
  IconArrowDown,
  IconArrowUp,
  IconEye,
  IconHistory,
  IconInline,
  IconSplit,
  IconWrap,
  IconX,
} from "./icons";

interface DiffPreviewWorkspaceProps {
  repoPath: string;
  file: ChangedFile;
  source: SelectedFileSource | null;
  commitHash?: string;
  diffMode: DiffMode;
  onChangeDiffMode: (mode: DiffMode) => void;
  onClose: () => void;
  onStageFile?: (file: ChangedFile) => void;
  onUnstageFile?: (file: ChangedFile) => void;
  onEditFile?: (file: ChangedFile) => void;
}

export function DiffPreviewWorkspace({
  repoPath,
  file,
  source,
  commitHash,
  diffMode,
  onChangeDiffMode,
  onClose,
  onStageFile,
  onUnstageFile,
  onEditFile,
}: DiffPreviewWorkspaceProps) {
  const [hunks, setHunks] = useState<DiffHunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"diff" | "file">("diff");
  const [fileText, setFileText] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const result =
          source === "commit" && commitHash
            ? await gitClient.commitFileDiff(repoPath, commitHash, file.path)
            : await gitClient.diff(repoPath, file.path, source === "staged");
        if (cancelled) return;
        if (result.isBinary) {
          setHunks([]);
          setError("Binary file — diff not shown.");
        } else {
          setHunks(parseUnifiedDiff(result.text));
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to load diff";
          setError(message);
          toast.error(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repoPath, file.path, source, commitHash]);

  useEffect(() => {
    if (viewMode !== "file") return;
    let cancelled = false;
    setFileLoading(true);
    setFileText(null);
    (async () => {
      try {
        const src = source ?? "unstaged";
        const result = await gitClient.fileContent(repoPath, file.path, src === "commit" ? "commit" : src, commitHash);
        if (cancelled) return;
        if (result.isBinary) setFileText("[Binary file — cannot display]");
        else setFileText(result.text);
      } catch (err) {
        if (!cancelled) setFileText(`Error loading file: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        if (!cancelled) setFileLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [viewMode, repoPath, file.path, source, commitHash]);

  useEffect(() => {
    setViewMode("diff");
  }, [file.path]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="diff-workspace">
      <DiffHeader
        file={file}
        source={source}
        onClose={onClose}
        onStageFile={onStageFile}
        onUnstageFile={onUnstageFile}
      />
      <DiffToolbar
        source={source}
        diffMode={diffMode}
        viewMode={viewMode}
        onChangeDiffMode={onChangeDiffMode}
        onChangeViewMode={setViewMode}
        onEditFile={onEditFile ? () => onEditFile(file) : undefined}
      />
      {viewMode === "file" ? (
        fileLoading ? (
          <DiffPlaceholder>Loading file…</DiffPlaceholder>
        ) : fileText !== null ? (
          <FileViewer text={fileText} />
        ) : null
      ) : loading ? (
        <DiffPlaceholder>Loading diff…</DiffPlaceholder>
      ) : error ? (
        <DiffPlaceholder>{error}</DiffPlaceholder>
      ) : diffMode === "split" ? (
        <SplitDiffViewer hunks={hunks} />
      ) : (
        <InlineDiffViewer hunks={hunks} />
      )}
    </div>
  );
}

function DiffPlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 24,
        color: "var(--text-3)",
        fontSize: 12,
        fontFamily: "var(--font-mono)",
      }}
    >
      {children}
    </div>
  );
}

interface DiffHeaderProps {
  file: ChangedFile;
  source: SelectedFileSource | null;
  onClose: () => void;
  onStageFile?: (file: ChangedFile) => void;
  onUnstageFile?: (file: ChangedFile) => void;
}

function DiffHeader({ file, source, onClose, onStageFile, onUnstageFile }: DiffHeaderProps) {
  const { dir, file: fname } = splitPath(file.path);
  return (
    <div className="diff-header">
      <FileStatusIcon status={file.status} />
      <div className="path">
        <span className="dir">{dir}</span>
        <span className="file">{fname}</span>
      </div>
      <span className="encoding">UTF-8</span>
      {source === "unstaged" && (
        <div className="actions">
          <button className="stage-file" onClick={() => onStageFile?.(file)}>
            Stage File
          </button>
        </div>
      )}
      {source === "staged" && (
        <div className="actions">
          <button className="stage-file unstage" onClick={() => onUnstageFile?.(file)}>
            Unstage File
          </button>
        </div>
      )}
      <button className="x" onClick={onClose} title="Close diff (Esc)">
        <IconX size={14} />
      </button>
    </div>
  );
}

interface DiffToolbarProps {
  source: SelectedFileSource | null;
  diffMode: DiffMode;
  viewMode: "diff" | "file";
  onChangeDiffMode: (mode: DiffMode) => void;
  onChangeViewMode: (mode: "diff" | "file") => void;
  onEditFile?: () => void;
}

function DiffToolbar({ source, diffMode, viewMode, onChangeDiffMode, onChangeViewMode, onEditFile }: DiffToolbarProps) {
  return (
    <div className="diff-toolbar">
      {(source === "unstaged" || source === "staged") && (
        <button className="edit-btn" title="Edit this file" onClick={onEditFile}>
          Edit This File
        </button>
      )}

      {viewMode === "diff" && (
        <div className="seg" style={{ margin: "0 auto" }}>
          <button
            className={diffMode === "split" ? "active" : ""}
            onClick={() => onChangeDiffMode("split")}
            title="Split view"
          >
            <IconSplit size={12} /> Split View
          </button>
          <button
            className={diffMode === "inline" ? "active" : ""}
            onClick={() => onChangeDiffMode("inline")}
            title="Inline view"
          >
            <IconInline size={12} /> Inline View
          </button>
        </div>
      )}

      <div className="right-group" style={viewMode === "file" ? { marginLeft: "auto" } : {}}>
        <div className="seg">
          <button
            className={viewMode === "file" ? "active" : ""}
            title="File view"
            onClick={() => onChangeViewMode("file")}
          >
            <IconEye size={12} /> File View
          </button>
          <button
            className={viewMode === "diff" ? "active" : ""}
            title="Diff view"
            onClick={() => onChangeViewMode("diff")}
          >
            <IconSplit size={12} /> Diff View
          </button>
        </div>
        {viewMode === "diff" && (
          <>
            <div className="vert-divider" />
            <button className="nav-btn" title="Previous change">
              <IconArrowUp size={13} />
            </button>
            <button className="nav-btn" title="Next change">
              <IconArrowDown size={13} />
            </button>
          </>
        )}
        <div className="vert-divider" />
        <button className="nav-btn" title="Word wrap">
          <IconWrap size={13} />
        </button>
        <button className="nav-btn" title="Blame">
          <IconHistory size={13} />
        </button>
      </div>
    </div>
  );
}

interface DiffPair {
  left: DiffHunk["lines"][number] | null;
  right: DiffHunk["lines"][number] | null;
}

function buildPairs(hunk: DiffHunk): DiffPair[] {
  const pairs: DiffPair[] = [];
  const lines = hunk.lines;
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.kind === "ctx") {
      pairs.push({ left: l, right: l });
      i++;
    } else if (l.kind === "del") {
      const next = lines[i + 1];
      if (next && next.kind === "add") {
        pairs.push({ left: l, right: next });
        i += 2;
      } else {
        pairs.push({ left: l, right: null });
        i++;
      }
    } else {
      pairs.push({ left: null, right: l });
      i++;
    }
  }
  return pairs;
}

function SplitDiffViewer({ hunks }: { hunks: DiffHunk[] }) {
  if (!hunks || hunks.length === 0) {
    return <DiffPlaceholder>No differences found.</DiffPlaceholder>;
  }

  return (
    <div className="diff-body split-diff">
      <div className="side">
        {hunks.map((h, hi) => (
          <Fragment key={hi}>
            <div className="dline hunk">
              <div className="ln">···</div>
              <div className="code">{h.header}</div>
            </div>
            {buildPairs(h).map((p, pi) =>
              p.left ? (
                <div key={pi} className={`dline ${p.left.kind === "ctx" ? "ctx" : "del"}`}>
                  <div className="ln">{p.left.oldLn ?? ""}</div>
                  <div
                    className="code"
                    dangerouslySetInnerHTML={{ __html: tokenize(p.left.text) }}
                  />
                </div>
              ) : (
                <div key={pi} className="dline empty">
                  <div className="ln"> </div>
                  <div className="code"> </div>
                </div>
              )
            )}
          </Fragment>
        ))}
      </div>

      <div className="side">
        {hunks.map((h, hi) => (
          <Fragment key={hi}>
            <div className="dline hunk">
              <div className="ln">···</div>
              <div className="code">{h.header}</div>
            </div>
            {buildPairs(h).map((p, pi) =>
              p.right ? (
                <div key={pi} className={`dline ${p.right.kind === "ctx" ? "ctx" : "add"}`}>
                  <div className="ln">{p.right.newLn ?? ""}</div>
                  <div
                    className="code"
                    dangerouslySetInnerHTML={{ __html: tokenize(p.right.text) }}
                  />
                </div>
              ) : (
                <div key={pi} className="dline empty">
                  <div className="ln"> </div>
                  <div className="code"> </div>
                </div>
              )
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function FileViewer({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  return (
    <div className="diff-body file-viewer">
      {lines.map((line, i) => (
        <div key={i} className="dline ctx">
          <div className="ln">{i + 1}</div>
          <div className="code">{line || " "}</div>
        </div>
      ))}
    </div>
  );
}

function InlineDiffViewer({ hunks }: { hunks: DiffHunk[] }) {
  if (!hunks || hunks.length === 0) {
    return <DiffPlaceholder>No differences found.</DiffPlaceholder>;
  }
  return (
    <div className="diff-body inline-diff">
      {hunks.map((h, hi) => (
        <Fragment key={hi}>
          <div className="dline hunk">
            <div className="ln">···</div>
            <div className="ln-r">···</div>
            <div className="code" style={{ fontStyle: "italic", color: "var(--text-3)" }}>
              {h.header}
            </div>
          </div>
          {h.lines.map((l, li) => (
            <div key={li} className={`dline ${l.kind}`}>
              <div className="ln">{l.oldLn ?? ""}</div>
              <div className="ln-r">{l.newLn ?? ""}</div>
              <div className="code" dangerouslySetInnerHTML={{ __html: tokenize(l.text) }} />
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  );
}
