import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { BranchSidebar } from "./components/BranchSidebar";
import { CommitGraph } from "./components/CommitGraph";
import { DiffPreviewWorkspace } from "./components/DiffPreviewWorkspace";
import { RepositoryLauncher } from "./components/RepositoryLauncher";
import { RightPanel } from "./components/RightPanel";
import {
  IconArchiveDown,
  IconArchiveUp,
  IconArrowClockwise,
  IconArrowCounterclockwise,
  IconBell,
  IconBranch,
  IconCaretDown,
  IconCloudArrowDown,
  IconCloudArrowUp,
  IconGear,
  IconSearch,
  IconTerminal,
  IconX,
} from "./components/icons";
import { useActiveRepo } from "./hooks/useActiveRepo";
import { useRepoData } from "./hooks/useRepoData";
import { gitClient } from "./services/gitClient";
import {
  commitFileToChangedFile,
  toBranches,
  toChangedFiles,
  toCommits,
} from "./utils/adapters";
import type {
  ChangedFile,
  Commit,
  DiffMode,
  LocalBranch,
  MainView,
  RemoteBranch,
  RightPanelMode,
  SelectedFileSource,
} from "./data/types";

interface ToolbarActionProps {
  icon: React.ReactNode;
  label: string;
  badge?: number;
  disabled?: boolean;
  split?: boolean;
  onClick?: () => void;
}

function ToolbarAction({ icon, label, badge, disabled, split, onClick }: ToolbarActionProps) {
  return (
    <button
      className={"toolbar-action" + (split ? " split-caret" : "")}
      disabled={disabled}
      onClick={onClick}
      title={label}
    >
      <span className="ico">
        {icon}
        {badge != null && badge > 0 && <span className="badge">{badge}</span>}
      </span>
      <span className="lbl">{label}</span>
      {split && (
        <span className="caret">
          <IconCaretDown size={9} />
        </span>
      )}
    </button>
  );
}

export function App() {
  const repoState = useActiveRepo();
  const { repo, repos, activePath } = repoState;

  return (
    <>
      <Toaster theme="dark" position="bottom-right" richColors closeButton />
      {!repo ? (
        <RepositoryLauncher
          recents={repoState.recents}
          onOpenPicker={repoState.openPicker}
          onOpenRepo={repoState.openByPath}
        />
      ) : (
        <RepoView
          key={repo.path}
          repoPath={repo.path}
          repoName={repo.name}
          openRepos={repos}
          activePath={activePath}
          onOpenPicker={repoState.openPicker}
          onSwitchRepo={repoState.setActiveByPath}
          onCloseRepo={repoState.closeByPath}
          onCloseAll={repoState.close}
        />
      )}
    </>
  );
}

interface RepoViewProps {
  repoPath: string;
  repoName: string;
  openRepos: Array<{ path: string; name: string }>;
  activePath: string | null;
  onOpenPicker: () => Promise<void>;
  onSwitchRepo: (path: string) => void;
  onCloseRepo: (path: string) => void;
  onCloseAll: () => void;
}

function RepoView({
  repoPath,
  repoName,
  openRepos,
  activePath,
  onOpenPicker,
  onSwitchRepo,
  onCloseRepo,
  onCloseAll
}: RepoViewProps) {
  const data = useRepoData(repoPath);
  const { status, history, branches } = data.data;

  const [mainView, setMainView] = useState<MainView>("graph");
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>("localChanges");
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null);
  const [selectedFile, setSelectedFile] = useState<ChangedFile | null>(null);
  const [selectedFileSource, setSelectedFileSource] = useState<SelectedFileSource | null>(null);
  const [diffMode, setDiffMode] = useState<DiffMode>("split");
  const [commitFiles, setCommitFiles] = useState<ChangedFile[]>([]);
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  const [branchQuery, setBranchQuery] = useState("");
  const branchMenuRef = useRef<HTMLDivElement | null>(null);

  const { unstaged, staged } = useMemo(
    () => (status ? toChangedFiles(status) : { unstaged: [], staged: [] }),
    [status]
  );

  const currentBranch = status?.branch || "—";

  const getRemoteBranchRef = useCallback((branch: RemoteBranch) => {
    const remotePath = branch.folder ? `${branch.folder}/${branch.name}` : branch.name;
    return `${branch.remote}/${remotePath}`;
  }, []);

  const { local: localBranches, remote: remoteBranches, currentBranchId } = useMemo(
    () => toBranches(branches, status),
    [branches, status]
  );

  const commits = useMemo(
    () => toCommits(history, { unstagedCount: unstaged.length, stagedCount: staged.length, currentBranch }),
    [history, unstaged.length, staged.length, currentBranch]
  );

  const allBranches = useMemo(
    () => [
      ...localBranches,
      ...remoteBranches.flatMap((branch) => (branch.isFolder ? branch.children ?? [] : [branch])),
    ],
    [localBranches, remoteBranches]
  );

  const filteredBranches = useMemo(() => {
    const query = branchQuery.trim().toLowerCase();
    if (!query) return allBranches;
    return allBranches.filter((branch) => {
      const fullName = branch.type === "remote" ? getRemoteBranchRef(branch) : branch.name;
      return fullName.toLowerCase().includes(query);
    });
  }, [allBranches, branchQuery, getRemoteBranchRef]);

  useEffect(() => {
    if (!selectedCommit || selectedCommit.isWip) {
      setCommitFiles([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const details = await gitClient.commitDetails(repoPath, selectedCommit.id);
        if (!cancelled) {
          setCommitFiles(details.files.map(commitFileToChangedFile));
        }
      } catch (err) {
        if (!cancelled) {
          setCommitFiles([]);
          toast.error(err instanceof Error ? err.message : "Failed to load commit");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCommit, repoPath]);

  useEffect(() => {
    if (!isBranchMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!branchMenuRef.current?.contains(event.target as Node)) {
        setIsBranchMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [isBranchMenuOpen]);

  const handleSelectCommit = useCallback((commit: Commit) => {
    if (commit.isWip) {
      setSelectedCommit(null);
      setRightPanelMode("localChanges");
      setMainView("graph");
      setSelectedFile(null);
      setSelectedFileSource(null);
      return;
    }
    setSelectedCommit(commit);
    setRightPanelMode("commitDetails");
    setMainView("graph");
    setSelectedFile(null);
    setSelectedFileSource(null);
  }, []);

  const handleSelectWip = useCallback(() => {
    setSelectedCommit(null);
    setRightPanelMode("localChanges");
    setMainView("graph");
    setSelectedFile(null);
    setSelectedFileSource(null);
  }, []);

  const handleCloseDiff = useCallback(() => {
    setSelectedFile(null);
    setSelectedFileSource(null);
    setMainView("graph");
  }, []);

  const handleSelectFile = useCallback(
    (file: ChangedFile) => {
      if (rightPanelMode === "commitDetails") {
        setSelectedFile(file);
        setSelectedFileSource("commit");
        setMainView("filePreview");
      } else if (staged.some((f) => f.id === file.id)) {
        setSelectedFile(file);
        setSelectedFileSource("staged");
        setMainView("filePreview");
      } else {
        setSelectedFile(file);
        setSelectedFileSource("unstaged");
        setMainView("filePreview");
      }
    },
    [rightPanelMode, staged]
  );

  const handleStageFile = useCallback(
    async (file: ChangedFile) => {
      if (selectedFile?.id === file.id) handleCloseDiff();
      await data.stageFile(file.path);
    },
    [data, selectedFile, handleCloseDiff]
  );

  const handleUnstageFile = useCallback(
    async (file: ChangedFile) => {
      if (selectedFile?.id === file.id) handleCloseDiff();
      await data.unstageFile(file.path);
    },
    [data, selectedFile, handleCloseDiff]
  );

  const handleStageAll = useCallback(async () => {
    if (unstaged.length === 0) return;
    setSelectedFile(null);
    setSelectedFileSource(null);
    setMainView("graph");
    await data.stageAll();
  }, [data, unstaged.length]);

  const handleUnstageAll = useCallback(async () => {
    if (staged.length === 0) return;
    setSelectedFile(null);
    setSelectedFileSource(null);
    setMainView("graph");
    await data.unstageAll();
  }, [data, staged.length]);

  const handleCommit = useCallback(
    async (summary: string, description: string) => {
      const message = description ? `${summary}\n\n${description}` : summary;
      const ok = await data.commit(message);
      if (ok) {
        setSelectedFile(null);
        setSelectedFileSource(null);
        setMainView("graph");
      }
    },
    [data]
  );

  const handleSelectBranch = useCallback((_branch: LocalBranch | RemoteBranch) => {
    // single click: highlight only
  }, []);

  const handleCheckoutBranch = useCallback(
    async (branch: LocalBranch | RemoteBranch) => {
      if (branch.type === "remote") {
        const fullName = getRemoteBranchRef(branch);
        await data.checkoutRemoteBranch(fullName);
      } else {
        await data.checkoutBranch(branch.name);
      }
    },
    [data, getRemoteBranchRef]
  );

  const handleCheckoutRef = useCallback(
    async (refName: string) => {
      if (!refName) return;

      const exact = allBranches.find((branch) => {
        const label = branch.type === "remote" ? getRemoteBranchRef(branch) : branch.name;
        return label === refName;
      });

      if (exact) {
        await handleCheckoutBranch(exact);
        return;
      }

      const localByName = localBranches.find((branch) => branch.name === refName);
      if (localByName) {
        await handleCheckoutBranch(localByName);
        return;
      }

      const remoteLeafBranches = remoteBranches.flatMap((branch) =>
        branch.isFolder ? branch.children ?? [] : [branch]
      );

      const remoteMatches = remoteLeafBranches.filter((branch) => {
        const full = getRemoteBranchRef(branch);
        const remotePath = branch.folder ? `${branch.folder}/${branch.name}` : branch.name;
        return full === refName || remotePath === refName || branch.name === refName;
      });

      if (remoteMatches.length === 1) {
        await handleCheckoutBranch(remoteMatches[0]!);
        return;
      }

      if (remoteMatches.length > 1) {
        toast.error(`Remote branch '${refName}' is ambiguous`);
      }
    },
    [allBranches, getRemoteBranchRef, handleCheckoutBranch, localBranches, remoteBranches]
  );

  const handleBranchMenuSelect = useCallback(
    async (branch: LocalBranch | RemoteBranch) => {
      await handleCheckoutBranch(branch);
      setIsBranchMenuOpen(false);
      setBranchQuery("");
    },
    [handleCheckoutBranch]
  );

  const handleBranchMenuSubmit = useCallback(async () => {
    const query = branchQuery.trim();
    if (!query) return;

    const normalizedQuery = query.toLowerCase();
    const exactMatch = allBranches.find((branch) => {
      const label = branch.type === "remote" ? getRemoteBranchRef(branch) : branch.name;
      return label.toLowerCase() === normalizedQuery;
    });

    if (exactMatch) {
      await handleBranchMenuSelect(exactMatch);
      return;
    }

    if (filteredBranches.length === 1) {
      await handleBranchMenuSelect(filteredBranches[0]!);
      return;
    }

    toast.error("Type the full branch name or narrow your search");
  }, [allBranches, branchQuery, filteredBranches, getRemoteBranchRef, handleBranchMenuSelect]);

  const handleCreateBranch = useCallback(async () => {
    const name = window.prompt("New branch name");
    if (!name || !name.trim()) return;
    await data.createBranch(name.trim());
  }, [data]);

  const handleEditFile = useCallback(
    async (file: ChangedFile) => {
      const fullPath = `${repoPath}/${file.path}`.replace(/\\/g, "/");
      try {
        const result = await gitClient.openRepoInVSCode(repoPath);
        if (!result.ok) toast.error(result.message || "Could not open editor");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not open editor");
      }
      void fullPath;
    },
    [repoPath]
  );

  const totalLocalChanges = unstaged.length + staged.length;

  return (
    <div className="app">
      <div className="tabbar">
        <button className="icon-btn" title="Launchpad" onClick={onCloseAll}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 4h12M2 8h12M2 12h12" />
          </svg>
        </button>
        {openRepos.map((openRepo) => {
          const isActive = openRepo.path === activePath;
          return (
            <div
              key={openRepo.path}
              className={"tab" + (isActive ? " active" : "")}
              onClick={() => onSwitchRepo(openRepo.path)}
              title={openRepo.path}
            >
              <span className="branch-icon">
                <IconBranch size={11} />
              </span>
              {openRepo.name}
              <button
                className="close"
                title="Close repository"
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseRepo(openRepo.path);
                }}
              >
                <IconX size={10} />
              </button>
            </div>
          );
        })}
        <button className="new-tab" title="Open repository" onClick={onCloseAll}>
          +
        </button>

        <div className="right">
          <button className="icon-btn" title="Notifications">
            <IconBell size={14} />
            <span className="dot" />
          </button>
          <button className="icon-btn" title="Settings">
            <IconGear size={14} />
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="field">
          <span className="label">repository</span>
          <span className="value">{repoName}</span>
        </div>
        <div className="divider" />
        <div className="field branch-field" ref={branchMenuRef}>
          <span className="label">branch</span>
          <button
            className="value branch-value-btn"
            title="Switch branch"
            onClick={() => setIsBranchMenuOpen((open) => !open)}
          >
            {currentBranch}
            <IconCaretDown size={12} style={{ color: "var(--text-3)" }} />
          </button>
          {isBranchMenuOpen && (
            <div className="branch-menu">
              <input
                type="text"
                placeholder="Search branches"
                value={branchQuery}
                onChange={(event) => setBranchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleBranchMenuSubmit();
                  }
                }}
                autoFocus
              />
              <div className="branch-menu-list">
                {filteredBranches.map((branch) => {
                  const label = branch.type === "remote" ? getRemoteBranchRef(branch) : branch.name;
                  const isCurrent = branch.id === currentBranchId;
                  return (
                    <button
                      key={branch.id}
                      className={"branch-menu-item" + (isCurrent ? " current" : "")}
                      onClick={() => void handleBranchMenuSelect(branch)}
                    >
                      <IconBranch size={12} />
                      <span>{label}</span>
                    </button>
                  );
                })}
                {filteredBranches.length === 0 && (
                  <div className="branch-menu-empty">No branches found</div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="actions">
          <ToolbarAction icon={<IconArrowCounterclockwise size={16} />} label="Undo" disabled />
          <ToolbarAction icon={<IconArrowClockwise size={16} />} label="Redo" disabled />
          <ToolbarAction
            icon={<IconCloudArrowDown size={16} />}
            label="Pull"
            badge={status?.behind || 0}
            onClick={() => void data.pull()}
          />
          <ToolbarAction
            icon={<IconCloudArrowUp size={16} />}
            label="Push"
            badge={status?.ahead || 0}
            onClick={() => void data.push()}
          />
          <ToolbarAction icon={<IconBranch size={16} />} label="Branch" onClick={handleCreateBranch} />
          <ToolbarAction
            icon={<IconArchiveDown size={16} />}
            label="Stash"
            disabled
          />
          <ToolbarAction
            icon={<IconArchiveUp size={16} />}
            label="Pop"
            disabled
          />
          <div className="divider" style={{ margin: "10px 4px" }} />
          <ToolbarAction
            icon={<IconTerminal size={16} />}
            label="Terminal"
            disabled
          />
          <div className="divider" style={{ margin: "10px 4px" }} />
          <button className="toolbar-action" style={{ minWidth: 0, padding: "4px 8px" }} title="Search">
            <span className="ico">
              <IconSearch size={15} />
            </span>
          </button>
        </div>
      </div>

      <div className="workarea">
        <BranchSidebar
          localBranches={localBranches}
          remoteBranches={remoteBranches}
          currentBranchId={currentBranchId}
          onSelectBranch={handleSelectBranch}
          onCheckoutBranch={handleCheckoutBranch}
        />

        <div className="center" style={{ position: "relative" }}>
          <CommitGraph
            commits={commits}
            selectedCommitId={selectedCommit?.id}
            onSelectCommit={handleSelectCommit}
            onSelectWip={handleSelectWip}
            onCheckoutRef={(refName) => void handleCheckoutRef(refName)}
          />
          {mainView === "filePreview" && selectedFile && (
            <DiffPreviewWorkspace
              key={`${selectedFile.id}-${selectedCommit?.id || "wip"}`}
              repoPath={repoPath}
              file={selectedFile}
              source={selectedFileSource}
              commitHash={selectedFileSource === "commit" ? selectedCommit?.id : undefined}
              diffMode={diffMode}
              onChangeDiffMode={setDiffMode}
              onClose={handleCloseDiff}
              onStageFile={handleStageFile}
              onUnstageFile={handleUnstageFile}
              onEditFile={handleEditFile}
            />
          )}
        </div>

        <RightPanel
          mode={rightPanelMode}
          selectedCommit={selectedCommit}
          commitFiles={commitFiles}
          selectedFileId={selectedFile?.id}
          unstagedFiles={unstaged}
          stagedFiles={staged}
          currentBranch={currentBranch}
          onSelectFile={handleSelectFile}
          onStageFile={handleStageFile}
          onUnstageFile={handleUnstageFile}
          onStageAll={handleStageAll}
          onUnstageAll={handleUnstageAll}
          onCommit={handleCommit}
        />
      </div>

      <div className="statusbar">
        <span className="item">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect width="10" height="10" rx="2" fill="var(--bg-3)" />
            <path d="M3 5h4M5 3v4" stroke="var(--text-3)" strokeWidth="1.2" />
          </svg>
          {history.length} commits
        </span>
        <span className="item">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <circle cx="5" cy="5" r="4" stroke="var(--text-3)" strokeWidth="1.2" />
          </svg>
          {localBranches.length} branches
        </span>
        {totalLocalChanges > 0 && (
          <span className="item" style={{ color: "var(--mod)" }}>
            {totalLocalChanges} changed
          </span>
        )}
        {status?.state.operationState && status.state.operationState !== "normal" && (
          <span className="item" style={{ color: "var(--del)" }}>
            {status.state.operationState}
          </span>
        )}
        <div className="right">
          <span className="item">{repoPath}</span>
        </div>
      </div>
    </div>
  );
}
