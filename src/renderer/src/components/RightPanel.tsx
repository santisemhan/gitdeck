import { useState } from "react";
import { toast } from "sonner";
import type { ChangedFile, Commit } from "../data/types";
import { formatDate, initials, splitPath, summarizeCounts } from "../data/mock";
import { FileStatusIcon } from "./FileStatusIcon";
import {
  IconCloudArrowUp,
  IconCommit,
  IconEye,
  IconPath,
  IconSort,
  IconTrash,
  IconTree,
} from "./icons";

interface RightPanelProps {
  mode: "localChanges" | "commitDetails";
  selectedCommit: Commit | null;
  commitFiles: ChangedFile[];
  selectedFileId?: string;
  unstagedFiles: ChangedFile[];
  stagedFiles: ChangedFile[];
  currentBranch: string;
  onSelectFile: (file: ChangedFile) => void;
  onStageFile: (file: ChangedFile) => void;
  onUnstageFile: (file: ChangedFile) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onCommit: (summary: string, description: string) => void;
}

export function RightPanel(props: RightPanelProps) {
  return (
    <div className="rpanel">
      {props.mode === "localChanges" ? (
        <LocalChangesPanel
          unstagedFiles={props.unstagedFiles}
          stagedFiles={props.stagedFiles}
          selectedFileId={props.selectedFileId}
          currentBranch={props.currentBranch}
          onSelectFile={props.onSelectFile}
          onStageFile={props.onStageFile}
          onUnstageFile={props.onUnstageFile}
          onStageAll={props.onStageAll}
          onUnstageAll={props.onUnstageAll}
          onCommit={props.onCommit}
        />
      ) : (
        <CommitDetailsPanel
          commit={props.selectedCommit}
          commitFiles={props.commitFiles}
          selectedFileId={props.selectedFileId}
          onSelectFile={props.onSelectFile}
        />
      )}
    </div>
  );
}

interface ChangedFileRowProps {
  file: ChangedFile;
  selected: boolean;
  onSelect: (file: ChangedFile) => void;
  actionLabel?: string;
  onAction?: (file: ChangedFile) => void;
}

function ChangedFileRow({ file, selected, onSelect, actionLabel, onAction }: ChangedFileRowProps) {
  const { dir, file: fname } = splitPath(file.path);
  return (
    <div
      className={"file-row" + (selected ? " selected" : "")}
      onClick={() => onSelect(file)}
      title={file.path}
    >
      <FileStatusIcon status={file.status} />
      <span className="path">
        <span className="dir">{dir}</span>
        <span className="file">{fname}</span>
      </span>
      {actionLabel && (
        <button
          className="stage-btn"
          onClick={(e) => {
            e.stopPropagation();
            onAction?.(file);
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

interface LocalChangesPanelProps {
  unstagedFiles: ChangedFile[];
  stagedFiles: ChangedFile[];
  selectedFileId?: string;
  currentBranch: string;
  onSelectFile: (file: ChangedFile) => void;
  onStageFile: (file: ChangedFile) => void;
  onUnstageFile: (file: ChangedFile) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onCommit: (summary: string, description: string) => void;
}

function LocalChangesPanel({
  unstagedFiles,
  stagedFiles,
  selectedFileId,
  currentBranch,
  onSelectFile,
  onStageFile,
  onUnstageFile,
  onStageAll,
  onUnstageAll,
  onCommit,
}: LocalChangesPanelProps) {
  const totalCount = unstagedFiles.length + stagedFiles.length;
  const [unstagedOpen, setUnstagedOpen] = useState(true);
  const [stagedOpen, setStagedOpen] = useState(true);
  const [pathView, setPathView] = useState<"path" | "tree">("path");

  return (
    <>
      <div className="rpanel-head">
        <button
          className="trash"
          title="Discard all changes"
          onClick={() => toast("Discard not implemented in this mock")}
        >
          <IconTrash size={14} />
        </button>
        <span className="title">
          {totalCount} file change{totalCount !== 1 ? "s" : ""} on
          <span className="branch-chip" style={{ marginLeft: 6 }}>
            {currentBranch}
          </span>
        </span>
      </div>

      <div className="files-toolbar">
        <button className="sort" title="Sort">
          <IconSort size={14} />
        </button>
        <div className="seg">
          <button
            className={pathView === "path" ? "active" : ""}
            onClick={() => setPathView("path")}
          >
            <IconPath size={12} /> Path
          </button>
          <button
            className={pathView === "tree" ? "active" : ""}
            onClick={() => setPathView("tree")}
          >
            <IconTree size={12} /> Tree
          </button>
        </div>
      </div>

      <div className="files-list" style={{ flex: 1, minHeight: 0 }}>
        <div className={"subsection" + (unstagedOpen ? "" : " collapsed")}>
          <div className="head" onClick={() => setUnstagedOpen((v) => !v)}>
            <span className="chev">›</span>
            <span>Unstaged Files</span>
            <span className="count">({unstagedFiles.length})</span>
            {unstagedFiles.length > 0 && (
              <button
                className="stage-all primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onStageAll();
                }}
                title="Stage all changes"
              >
                Stage All Changes
              </button>
            )}
          </div>
          {unstagedOpen &&
            unstagedFiles.map((f) => (
              <ChangedFileRow
                key={f.id}
                file={f}
                selected={f.id === selectedFileId}
                onSelect={onSelectFile}
                actionLabel="Stage"
                onAction={onStageFile}
              />
            ))}
          {unstagedOpen && unstagedFiles.length === 0 && (
            <div className="empty-row">No unstaged files</div>
          )}
        </div>

        <div className={"subsection" + (stagedOpen ? "" : " collapsed")}>
          <div className="head" onClick={() => setStagedOpen((v) => !v)}>
            <span className="chev">›</span>
            <span>Staged Files</span>
            <span className="count">({stagedFiles.length})</span>
            {stagedFiles.length > 0 && (
              <button
                className="stage-all"
                onClick={(e) => {
                  e.stopPropagation();
                  onUnstageAll();
                }}
                title="Unstage all"
              >
                Unstage All
              </button>
            )}
          </div>
          {stagedOpen &&
            stagedFiles.map((f) => (
              <ChangedFileRow
                key={f.id}
                file={f}
                selected={f.id === selectedFileId}
                onSelect={onSelectFile}
                actionLabel="Unstage"
                onAction={onUnstageFile}
              />
            ))}
          {stagedOpen && stagedFiles.length === 0 && (
            <div className="empty-row">No staged files</div>
          )}
        </div>
      </div>

      <CommitForm stagedCount={stagedFiles.length} onCommit={onCommit} />
    </>
  );
}

interface CommitFormProps {
  stagedCount: number;
  onCommit: (summary: string, description: string) => void;
}

function CommitForm({ stagedCount, onCommit }: CommitFormProps) {
  const [summary, setSummary] = useState("");
  const [desc, setDesc] = useState("");
  const maxLen = 72;
  const remaining = maxLen - summary.length;
  const canCommit = stagedCount > 0 && summary.trim().length > 0;

  const submit = () => {
    if (!canCommit) return;
    onCommit(summary.trim(), desc.trim());
    setSummary("");
    setDesc("");
  };

  return (
    <div className="commit-form-wrap">
      <div className="splitter" title="Drag to resize" />

      <div className="ftabs">
        <button className="ftab active" title="Commit staged changes">
          <span className="ico">
            <IconCommit size={13} />
          </span>
          Commit
        </button>
        <button className="ftab" title="Push changes to remote" style={{ marginLeft: "auto" }}>
          <span className="ico">
            <IconCloudArrowUp size={13} />
          </span>
        </button>
        <button className="ftab" title="Stash">
          <span className="ico" style={{ fontSize: 11 }}>⊙</span>
        </button>
      </div>

      <div className="summary">
        <input
          type="text"
          placeholder="Commit summary"
          value={summary}
          maxLength={maxLen + 20}
          onChange={(e) => setSummary(e.target.value)}
        />
        <span className="counter" style={{ color: remaining < 10 ? "var(--del)" : undefined }}>
          {remaining}
        </span>
      </div>

      <div className="desc">
        <textarea
          rows={2}
          placeholder="Description"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
      </div>

      <button
        className="submit"
        disabled={!canCommit}
        onClick={submit}
        title={!canCommit ? "Stage files and write a summary first" : "Commit staged changes"}
      >
        <IconCommit size={14} />
        {stagedCount > 0 ? `Commit ${stagedCount} file${stagedCount === 1 ? "" : "s"}` : "Stage Changes to Commit"}
      </button>
    </div>
  );
}

interface CommitDetailsPanelProps {
  commit: Commit | null;
  commitFiles: ChangedFile[];
  selectedFileId?: string;
  onSelectFile: (file: ChangedFile) => void;
}

function CommitDetailsPanel({
  commit,
  commitFiles,
  selectedFileId,
  onSelectFile,
}: CommitDetailsPanelProps) {
  const [pathView, setPathView] = useState<"path" | "tree">("path");

  if (!commit) {
    return (
      <div style={{ padding: 20, color: "var(--text-3)", fontSize: 12 }}>
        Select a commit to see details.
      </div>
    );
  }

  const counts = summarizeCounts(commitFiles);
  const totalAdd = commitFiles.reduce((s, f) => s + (f.additions || 0), 0);
  const totalDel = commitFiles.reduce((s, f) => s + (f.deletions || 0), 0);
  const parentHash = commit.parents[0]?.replace("c-", "").slice(0, 7) || "—";

  return (
    <>
      <div className="rpanel-head">
        <span
          className="title"
          style={{ flexDirection: "column", gap: 0, alignItems: "flex-start" }}
        >
          <span
            style={{
              fontSize: 11,
              color: "var(--text-3)",
              marginBottom: 2,
              fontFamily: "var(--font-mono)",
            }}
          >
            commit: <span style={{ color: "var(--text-2)" }}>{commit.hash}</span>
          </span>
        </span>
      </div>

      <div className="commit-details">
        <p className="msg">{commit.title}</p>
        {commit.body && <p className="body">{commit.body}</p>}
      </div>

      <div className="author-strip">
        <div className="avatar">{initials(commit.author)}</div>
        <div>
          <div className="who">{commit.author}</div>
          <div className="when">authored {formatDate(commit.dateISO)}</div>
        </div>
        <div className="parent">
          parent<span className="hash">{parentHash}</span>
        </div>
      </div>

      <div className="change-summary">
        {counts.modified > 0 && (
          <span className="seg mod">
            <span className="num">✎ {counts.modified}</span> modified
          </span>
        )}
        {counts.added > 0 && (
          <span className="seg add">
            <span className="num">+ {counts.added}</span> added
          </span>
        )}
        {counts.deleted > 0 && (
          <span className="seg del">
            <span className="num">- {counts.deleted}</span> deleted
          </span>
        )}
        {counts.renamed > 0 && (
          <span className="seg ren">
            <span className="num">⇢ {counts.renamed}</span> renamed
          </span>
        )}
        {totalAdd + totalDel > 0 && (
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-3)" }}>
            <span style={{ color: "var(--add)" }}>+{totalAdd}</span>{" "}
            <span style={{ color: "var(--del)" }}>-{totalDel}</span>
          </span>
        )}
      </div>

      <div className="files-toolbar">
        <button className="sort" title="Sort">
          <IconSort size={14} />
        </button>
        <button
          title="View all files"
          style={{
            fontSize: 11,
            color: "var(--text-3)",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <IconEye size={12} /> View all files
        </button>
        <div className="seg">
          <button
            className={pathView === "path" ? "active" : ""}
            onClick={() => setPathView("path")}
          >
            <IconPath size={12} /> Path
          </button>
          <button
            className={pathView === "tree" ? "active" : ""}
            onClick={() => setPathView("tree")}
          >
            <IconTree size={12} /> Tree
          </button>
        </div>
      </div>

      <div className="files-list">
        {commitFiles.map((f) => (
          <ChangedFileRow
            key={f.id}
            file={f}
            selected={f.id === selectedFileId}
            onSelect={onSelectFile}
          />
        ))}
      </div>
    </>
  );
}
