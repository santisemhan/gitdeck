import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { ChangedFile, Commit } from "../data/types";
import { splitPath, summarizeCounts } from "../data/mock";
import { formatDate } from "../utils/date";
import { Avatar } from "./Avatar";
import { FileStatusIcon } from "./FileStatusIcon";
import { IconCaretLeft, IconCaretRight, IconTrash } from "./icons";
import { PanelSection } from "./PanelSection";
import { CommitForm } from "./CommitForm";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { readStoredNumber, writeStoredNumber } from "../utils/storage";

function shouldIgnoreArrowNavigation(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

function useArrowFileNavigation(
  files: ChangedFile[],
  selectedFileId: string | undefined,
  onSelectFile: (file: ChangedFile) => void,
) {
  useEffect(() => {
    if (files.length === 0) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      if (shouldIgnoreArrowNavigation(event.target)) return;

      const selectedIndex = files.findIndex((file) => file.id === selectedFileId);
      const fallbackIndex = event.key === "ArrowDown" ? 0 : files.length - 1;
      const currentIndex = selectedIndex >= 0 ? selectedIndex : fallbackIndex;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = Math.max(0, Math.min(currentIndex + delta, files.length - 1));
      const nextFile = files[nextIndex];
      if (!nextFile) return;

      event.preventDefault();
      onSelectFile(nextFile);
      requestAnimationFrame(() => {
        const rows = document.querySelectorAll<HTMLElement>(".file-row[data-file-id]");
        const targetRow = Array.from(rows).find((row) => row.dataset.fileId === nextFile.id);
        targetRow?.scrollIntoView({ block: "nearest" });
      });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [files, selectedFileId, onSelectFile]);
}

interface RightPanelProps {
  repoPath: string;
  mode: "localChanges" | "commitDetails";
  selectedCommit: Commit | null;
  commitFiles: ChangedFile[];
  selectedFileId?: string;
  unstagedFiles: ChangedFile[];
  stagedFiles: ChangedFile[];
  currentBranch: string;
  totalLocalChanges: number;
  onSelectFile: (file: ChangedFile) => void;
  onStageFile: (file: ChangedFile) => void;
  onUnstageFile: (file: ChangedFile) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onRequestDiscardAll: () => void;
  onCommit: (summary: string, description: string) => void;
  onViewLocalChanges: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onStartResize?: (event: ReactMouseEvent<HTMLDivElement>) => void;
}

export function RightPanel(props: RightPanelProps) {
  if (props.collapsed) {
    return (
      <aside className="panel-rail right" aria-label="Right panel collapsed">
        <button
          type="button"
          title="Expand right panel"
          aria-label="Expand right panel"
          onClick={props.onToggleCollapsed}
        >
          <IconCaretLeft size={14} />
        </button>
      </aside>
    );
  }
  return (
    <div className="rpanel">
      {props.onStartResize && (
        <div
          className="panel-resize-handle panel-resize-handle-left"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize right panel"
          onMouseDown={props.onStartResize}
        />
      )}
      {props.onToggleCollapsed && (
        <button
          type="button"
          className="panel-collapse-btn rpanel-collapse-btn"
          title="Collapse right panel"
          aria-label="Collapse right panel"
          onClick={props.onToggleCollapsed}
        >
          <IconCaretRight size={14} />
        </button>
      )}
      {props.mode === "localChanges" ? (
        <LocalChangesPanel
          repoPath={props.repoPath}
          unstagedFiles={props.unstagedFiles}
          stagedFiles={props.stagedFiles}
          selectedFileId={props.selectedFileId}
          currentBranch={props.currentBranch}
          onSelectFile={props.onSelectFile}
          onStageFile={props.onStageFile}
          onUnstageFile={props.onUnstageFile}
          onStageAll={props.onStageAll}
          onUnstageAll={props.onUnstageAll}
          onRequestDiscardAll={props.onRequestDiscardAll}
          onCommit={props.onCommit}
        />
      ) : (
        <CommitDetailsPanel
          commit={props.selectedCommit}
          commitFiles={props.commitFiles}
          totalLocalChanges={props.totalLocalChanges}
          currentBranch={props.currentBranch}
          selectedFileId={props.selectedFileId}
          onSelectFile={props.onSelectFile}
          onViewLocalChanges={props.onViewLocalChanges}
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
  actionVariant?: "stage" | "unstage";
  onAction?: (file: ChangedFile) => void;
}

function ChangedFileRow({ file, selected, onSelect, actionLabel, actionVariant, onAction }: ChangedFileRowProps) {
  const { dir, file: fname } = splitPath(file.path);
  return (
    <div
      className={"file-row" + (selected ? " selected" : "")}
      onClick={() => onSelect(file)}
      title={file.path}
      data-file-id={file.id}
    >
      <FileStatusIcon status={file.status} />
      <span className="path">
        <span className="dir">{dir}</span>
        <span className="file">{fname}</span>
      </span>
      {actionLabel && (
        <button
          className={"stage-btn" + (actionVariant ? ` ${actionVariant}` : "")}
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
  repoPath: string;
  unstagedFiles: ChangedFile[];
  stagedFiles: ChangedFile[];
  selectedFileId?: string;
  currentBranch: string;
  onSelectFile: (file: ChangedFile) => void;
  onStageFile: (file: ChangedFile) => void;
  onUnstageFile: (file: ChangedFile) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onRequestDiscardAll: () => void;
  onCommit: (summary: string, description: string) => void;
}

function LocalChangesPanel({
  repoPath,
  unstagedFiles,
  stagedFiles,
  selectedFileId,
  currentBranch,
  onSelectFile,
  onStageFile,
  onUnstageFile,
  onStageAll,
  onUnstageAll,
  onRequestDiscardAll,
  onCommit,
}: LocalChangesPanelProps) {
  const minSectionHeight = 110;
  const minCommitHeight = 210;
  const minFilesHeight = 120;
  const totalCount = unstagedFiles.length + stagedFiles.length;
  const [unstagedOpen, setUnstagedOpen] = useState(true);
  const [stagedOpen, setStagedOpen] = useState(true);
  const [commitHeight, setCommitHeight] = useState(() =>
    Math.max(minCommitHeight, readStoredNumber(STORAGE_KEYS.rightPanelCommitHeight, 250))
  );
  const [unstagedHeight, setUnstagedHeight] = useState(() =>
    Math.max(minSectionHeight, readStoredNumber(STORAGE_KEYS.rightPanelUnstagedHeight, 250))
  );
  const filesListRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{
    startY: number;
    startHeight: number;
    maxHeight: number;
  } | null>(null);
  const commitResizeRef = useRef<{
    startY: number;
    startHeight: number;
    maxHeight: number;
  } | null>(null);

  const onResizeMove = useCallback(
    (event: MouseEvent) => {
      const state = resizeRef.current;
      if (!state) return;
      const delta = event.clientY - state.startY;
      const nextHeight = Math.max(minSectionHeight, Math.min(state.startHeight + delta, state.maxHeight));
      setUnstagedHeight(nextHeight);
    },
    [minSectionHeight],
  );

  const stopResize = useCallback(() => {
    window.removeEventListener("mousemove", onResizeMove);
    window.removeEventListener("mouseup", stopResize);
    resizeRef.current = null;
  }, [onResizeMove]);

  const startResize = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const listEl = filesListRef.current;
      if (!listEl) return;

      const listHeight = listEl.getBoundingClientRect().height;
      const maxHeight = Math.max(minSectionHeight, listHeight - minSectionHeight);

      resizeRef.current = {
        startY: event.clientY,
        startHeight: unstagedHeight,
        maxHeight,
      };

      window.addEventListener("mousemove", onResizeMove);
      window.addEventListener("mouseup", stopResize);
      event.preventDefault();
    },
    [minSectionHeight, onResizeMove, stopResize, unstagedHeight],
  );

  const onCommitResizeMove = useCallback(
    (event: MouseEvent) => {
      const state = commitResizeRef.current;
      if (!state) return;
      const delta = state.startY - event.clientY;
      const nextHeight = Math.max(minCommitHeight, Math.min(state.startHeight + delta, state.maxHeight));
      setCommitHeight(nextHeight);
    },
    [minCommitHeight],
  );

  const stopCommitResize = useCallback(() => {
    window.removeEventListener("mousemove", onCommitResizeMove);
    window.removeEventListener("mouseup", stopCommitResize);
    commitResizeRef.current = null;
  }, [onCommitResizeMove]);

  const startCommitResize = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const listEl = filesListRef.current;
      if (!listEl) return;

      const listHeight = listEl.getBoundingClientRect().height;
      const combinedHeight = listHeight + commitHeight;
      const maxHeight = Math.max(minCommitHeight, combinedHeight - minFilesHeight);

      commitResizeRef.current = {
        startY: event.clientY,
        startHeight: commitHeight,
        maxHeight,
      };

      window.addEventListener("mousemove", onCommitResizeMove);
      window.addEventListener("mouseup", stopCommitResize);
      event.preventDefault();
    },
    [commitHeight, minCommitHeight, minFilesHeight, onCommitResizeMove, stopCommitResize],
  );

  useEffect(() => stopResize, [stopResize]);
  useEffect(() => stopCommitResize, [stopCommitResize]);
  useEffect(() => {
    writeStoredNumber(STORAGE_KEYS.rightPanelUnstagedHeight, unstagedHeight);
  }, [unstagedHeight]);
  useEffect(() => {
    writeStoredNumber(STORAGE_KEYS.rightPanelCommitHeight, commitHeight);
  }, [commitHeight]);

  const unstagedSectionStyle = unstagedOpen
    ? {
        flex: stagedOpen ? `0 0 ${unstagedHeight}px` : "1 1 auto",
        minHeight: `${minSectionHeight}px`,
      }
    : undefined;

  const stagedSectionStyle = stagedOpen
    ? {
        flex: "1 1 auto",
        minHeight: `${minSectionHeight}px`,
      }
    : undefined;

  const sectionBodyStyle = {
    flex: "1 1 auto",
    minHeight: 0,
    maxHeight: "none",
    resize: "none" as const,
  };

  const navigationFiles = useMemo(
    () => [...unstagedFiles, ...stagedFiles],
    [unstagedFiles, stagedFiles],
  );

  useArrowFileNavigation(navigationFiles, selectedFileId, onSelectFile);

  return (
    <>
      <div className="rpanel-head">
        {totalCount > 0 && (
          <button
            className="trash"
            title="Discard all changes"
            aria-label="discard all"
            onClick={onRequestDiscardAll}
          >
            <IconTrash size={16} />
          </button>
        )}
        <span className="title">
          {totalCount} file change{totalCount !== 1 ? "s" : ""} on
          <span className="branch-chip branch-chip-offset">
            {currentBranch}
          </span>
        </span>
      </div>

      <div className="files-list local-files-list" ref={filesListRef}>
          <PanelSection
            title="Unstaged Files"
            count={unstagedFiles.length}
            open={unstagedOpen}
            onToggle={() => setUnstagedOpen((v) => !v)}
            style={unstagedSectionStyle}
            bodyStyle={sectionBodyStyle}
            action={
              unstagedFiles.length > 0 ? (
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
              ) : undefined
            }
            empty={<div className="empty-row">No unstaged files</div>}
          >
            {unstagedFiles.map((f) => (
              <ChangedFileRow
                key={f.id}
                file={f}
                selected={f.id === selectedFileId}
                onSelect={onSelectFile}
                actionLabel="Stage"
                actionVariant="stage"
                onAction={onStageFile}
              />
            ))}
          </PanelSection>

          {unstagedOpen && stagedOpen && (
            <div
              className="section-splitter"
              title="Drag to resize"
              onMouseDown={startResize}
            />
          )}

          <PanelSection
            title="Staged Files"
            count={stagedFiles.length}
            open={stagedOpen}
            onToggle={() => setStagedOpen((v) => !v)}
            style={stagedSectionStyle}
            bodyStyle={sectionBodyStyle}
            action={
              stagedFiles.length > 0 ? (
                <button
                  className="stage-all unstage-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnstageAll();
                  }}
                  title="Unstage all"
                >
                  Unstage All
                </button>
              ) : undefined
            }
            empty={<div className="empty-row">No staged files</div>}
          >
            {stagedFiles.map((f) => (
              <ChangedFileRow
                key={f.id}
                file={f}
                selected={f.id === selectedFileId}
                onSelect={onSelectFile}
                actionLabel="Unstage"
                actionVariant="unstage"
                onAction={onUnstageFile}
              />
            ))}
          </PanelSection>
        </div>

      <CommitForm
        repoPath={repoPath}
        stagedCount={stagedFiles.length}
        onCommit={onCommit}
        height={commitHeight}
        onStartResize={startCommitResize}
      />
    </>
  );
}

interface CommitDetailsPanelProps {
  commit: Commit | null;
  commitFiles: ChangedFile[];
  totalLocalChanges: number;
  currentBranch: string;
  selectedFileId?: string;
  onSelectFile: (file: ChangedFile) => void;
  onViewLocalChanges: () => void;
}

function CommitDetailsPanel({
  commit,
  commitFiles,
  totalLocalChanges,
  currentBranch,
  selectedFileId,
  onSelectFile,
  onViewLocalChanges,
}: CommitDetailsPanelProps) {
  useArrowFileNavigation(commitFiles, selectedFileId, onSelectFile);

  if (!commit) {
    return (
      <div className="commit-empty-state">
        Select a commit to see details.
      </div>
    );
  }

  const counts = summarizeCounts(commitFiles);
  const totalAdd = commitFiles.reduce((s, f) => s + (f.additions || 0), 0);
  const totalDel = commitFiles.reduce((s, f) => s + (f.deletions || 0), 0);
  const parentHash = commit.parents[0]?.replace("c-", "").slice(0, 7) || "—";
  const showAuthor = !commit.isStash;

  return (
    <>
      <div className="rpanel-head">
        <span className="title title-stacked">
          <span className="commit-meta-line">
            commit: <span className="commit-hash-muted">{commit.hash}</span>
          </span>
        </span>
      </div>

      {totalLocalChanges > 0 && (
        <div className="rpanel-head rpanel-head-local-link">
          <span className="title">
            {totalLocalChanges} file change{totalLocalChanges !== 1 ? "s" : ""} on
            <span className="branch-chip branch-chip-offset">{currentBranch}</span>
          </span>
          <button className="view-changes" onClick={onViewLocalChanges}>
            View Changes
          </button>
        </div>
      )}

      <div className="commit-details">
        <p className="msg">{commit.title}</p>
        {commit.body && <p className="body">{commit.body}</p>}
      </div>

      <div className="author-strip">
        {showAuthor ? (
          <>
            <Avatar name={commit.author} email={commit.email} />
            <div>
              <div className="who">{commit.author}</div>
              <div className="when">authored {formatDate(commit.dateISO)}</div>
            </div>
          </>
        ) : (
          <div>
            <div className="who">stash entry</div>
            <div className="when">saved {formatDate(commit.dateISO)}</div>
          </div>
        )}
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
          <span className="change-totals">
            <span className="plus">+{totalAdd}</span>{" "}
            <span className="minus">-{totalDel}</span>
          </span>
        )}
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
