import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { BranchSidebar } from "./components/BranchSidebar";
import { CommitGraph } from "./components/CommitGraph";
import { DeleteWorktreeDialog } from "./components/DeleteWorktreeDialog";
import { DiffPreviewWorkspace } from "./components/DiffPreviewWorkspace";
import { FileHistoryWorkspace } from "./components/FileHistoryWorkspace";
import { RepoStatusBar } from "./components/RepoStatusBar";
import { RepoTabBar } from "./components/RepoTabBar";
import { RepoToolbar } from "./components/RepoToolbar";
import { RepositoryLauncher } from "./components/RepositoryLauncher";
import { RightPanel } from "./components/RightPanel";
import { TerminalPanel } from "./components/TerminalPanel";
import { useActiveRepo } from "./hooks/useActiveRepo";
import { useRepoData } from "./hooks/useRepoData";
import { usePanelWidth } from "./hooks/usePanelWidth";
import { useWorktrees } from "./hooks/useWorktrees";
import { useDeleteWorktree } from "./hooks/useDeleteWorktree";
import { useOpenInFinder } from "./hooks/useOpenInFinder";
import { usePruneWorktree } from "./hooks/usePruneWorktree";
import { gitClient } from "./services/gitClient";
import { STORAGE_KEYS } from "./constants/storageKeys";
import { readStoredBoolean, writeStoredBoolean } from "./utils/storage";
import type { CSSProperties } from "react";

const LEFT_PANEL_MIN_WIDTH = 180;
const RIGHT_PANEL_MIN_WIDTH = 300;
const LEFT_PANEL_MAX_FRACTION = 0.7;
const RIGHT_PANEL_MAX_FRACTION = 0.35;
const CENTER_MIN_WIDTH = 200;
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
import type { WorktreeInfo } from "../../shared/types";

interface BranchMenuItem {
  branch: LocalBranch | RemoteBranch;
  label: string;
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
          onReorderRepo={repoState.reorderByPath}
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
  onReorderRepo: (sourcePath: string, targetPath: string) => void;
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
  onReorderRepo,
  onCloseAll
}: RepoViewProps) {
  const data = useRepoData(repoPath);
  const { status, history, branches, stashes } = data.data;
  const { worktrees, refresh: refreshWorktrees } = useWorktrees(repoPath);
  const deleteWorktree = useDeleteWorktree(repoPath, refreshWorktrees);
  const { openInFinder } = useOpenInFinder();
  const { prune: pruneWorktree, loading: pruning } = usePruneWorktree(repoPath, refreshWorktrees);

  const [mainView, setMainView] = useState<MainView>("graph");
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>("localChanges");
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(() =>
    readStoredBoolean(STORAGE_KEYS.leftPanelCollapsed, false),
  );
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(() =>
    readStoredBoolean(STORAGE_KEYS.rightPanelCollapsed, false),
  );
  useEffect(() => {
    writeStoredBoolean(STORAGE_KEYS.leftPanelCollapsed, leftPanelCollapsed);
  }, [leftPanelCollapsed]);
  useEffect(() => {
    writeStoredBoolean(STORAGE_KEYS.rightPanelCollapsed, rightPanelCollapsed);
  }, [rightPanelCollapsed]);
  const toggleRightPanel = useCallback(() => setRightPanelCollapsed((v) => !v), []);

  // Auto-collapse the left panel when entering file preview, auto-expand when leaving.
  // Skip the initial render so we don't clobber the user's persisted preference on app start.
  const prevMainViewRef = useRef(mainView);
  useEffect(() => {
    if (prevMainViewRef.current === mainView) return;
    prevMainViewRef.current = mainView;
    setLeftPanelCollapsed(mainView === "filePreview");
  }, [mainView]);

  // Track the other panel's width via refs so the max-width callbacks read fresh values.
  const leftWidthRef = useRef(240);
  const rightWidthRef = useRef(468);

  const leftPanel = usePanelWidth({
    initial: 240,
    min: LEFT_PANEL_MIN_WIDTH,
    max: () => {
      const vw = typeof window === "undefined" ? Number.MAX_SAFE_INTEGER : window.innerWidth;
      const capByViewport = Math.round(vw * LEFT_PANEL_MAX_FRACTION);
      const otherWidth = rightPanelCollapsed ? 32 : rightWidthRef.current;
      const capByCenter = vw - otherWidth - CENTER_MIN_WIDTH;
      return Math.max(LEFT_PANEL_MIN_WIDTH, Math.min(capByViewport, capByCenter));
    },
    storageKey: STORAGE_KEYS.leftPanelWidth,
    grow: "right",
  });
  const rightPanel = usePanelWidth({
    initial: 468,
    min: RIGHT_PANEL_MIN_WIDTH,
    max: () => {
      const vw = typeof window === "undefined" ? Number.MAX_SAFE_INTEGER : window.innerWidth;
      const capByViewport = Math.round(vw * RIGHT_PANEL_MAX_FRACTION);
      const otherWidth = leftPanelCollapsed ? 32 : leftWidthRef.current;
      const capByCenter = vw - otherWidth - CENTER_MIN_WIDTH;
      return Math.max(RIGHT_PANEL_MIN_WIDTH, Math.min(capByViewport, capByCenter));
    },
    storageKey: STORAGE_KEYS.rightPanelWidth,
    grow: "left",
  });
  leftWidthRef.current = leftPanel.width;
  rightWidthRef.current = rightPanel.width;

  // Re-clamp on viewport resize so panels never push the center below CENTER_MIN_WIDTH.
  useEffect(() => {
    const onResize = () => {
      leftPanel.setWidth(leftPanel.width);
      rightPanel.setWidth(rightPanel.width);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [leftPanel, rightPanel]);

  const workareaStyle: CSSProperties = {
    ["--sidebar-w" as string]: `${leftPanel.width}px`,
    ["--rpanel-w" as string]: `${rightPanel.width}px`,
  };
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null);
  const [selectedFile, setSelectedFile] = useState<ChangedFile | null>(null);
  const [selectedFileSource, setSelectedFileSource] = useState<SelectedFileSource | null>(null);
  const [diffMode, setDiffMode] = useState<DiffMode>("split");
  const [commitFiles, setCommitFiles] = useState<ChangedFile[]>([]);
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  const [branchQuery, setBranchQuery] = useState("");
  const [showDiscardAllBanner, setShowDiscardAllBanner] = useState(false);
  const [branchNameInput, setBranchNameInput] = useState("");
  const [branchStartPoint, setBranchStartPoint] = useState<string | null>(null);
  const [showCreateBranchBanner, setShowCreateBranchBanner] = useState(false);
  const [renameBranchOldName, setRenameBranchOldName] = useState<string | null>(null);
  const [renameBranchInput, setRenameBranchInput] = useState("");
  const [showRenameBranchBanner, setShowRenameBranchBanner] = useState(false);
  const [fileHistoryPath, setFileHistoryPath] = useState<string | null>(null);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(220);
  const branchMenuRef = useRef<HTMLDivElement | null>(null);

  const { unstaged, staged } = useMemo(
    () => (status ? toChangedFiles(status) : { unstaged: [], staged: [] }),
    [status]
  );

  const wipCounts = useMemo(() => {
    const counts = { added: 0, modified: 0, deleted: 0, renamed: 0 };
    for (const file of [...unstaged, ...staged]) {
      counts[file.status] += 1;
    }
    return counts;
  }, [staged, unstaged]);

  const currentBranch = status?.branch || "—";

  const getRemoteBranchRef = useCallback((branch: RemoteBranch) => {
    const remotePath = branch.folder ? `${branch.folder}/${branch.name}` : branch.name;
    return `${branch.remote}/${remotePath}`;
  }, []);

  const getBranchMenuLabel = useCallback((branch: LocalBranch | RemoteBranch) => {
    if (branch.type === "local") return branch.name;
    const remotePath = branch.folder ? `${branch.folder}/${branch.name}` : branch.name;
    return branch.remote === "origin" ? remotePath : `${branch.remote}/${remotePath}`;
  }, []);

  const { local: localBranches, remote: remoteBranches, currentBranchId } = useMemo(
    () => toBranches(branches, status),
    [branches, status]
  );

  const commits = useMemo(
    () =>
      toCommits(history, {
        unstagedCount: unstaged.length,
        stagedCount: staged.length,
        wipCounts,
        currentBranch,
        stashes
      }),
    [history, unstaged.length, staged.length, wipCounts, currentBranch, stashes]
  );

  const allBranches = useMemo(
    () => [
      ...localBranches,
      ...remoteBranches.flatMap((branch) => (branch.isFolder ? branch.children ?? [] : [branch])),
    ],
    [localBranches, remoteBranches]
  );

  const branchMenuItems = useMemo<BranchMenuItem[]>(() => {
    const deduped = new Map<string, BranchMenuItem>();
    for (const branch of allBranches) {
      const label = getBranchMenuLabel(branch);
      const key = label.toLowerCase();
      const current = deduped.get(key);
      if (!current) {
        deduped.set(key, { branch, label });
        continue;
      }
      if (current.branch.type === "remote" && branch.type === "local") {
        deduped.set(key, { branch, label });
      }
    }
    return Array.from(deduped.values());
  }, [allBranches, getBranchMenuLabel]);

  const filteredBranchMenuItems = useMemo(() => {
    const query = branchQuery.trim().toLowerCase();
    if (!query) return branchMenuItems;
    return branchMenuItems.filter(({ label }) => label.toLowerCase().includes(query));
  }, [branchMenuItems, branchQuery]);

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

  const resetToGraph = useCallback(() => {
    setSelectedCommit(null);
    setRightPanelMode("localChanges");
    setMainView("graph");
    setSelectedFile(null);
    setSelectedFileSource(null);
  }, []);

  const handleSelectCommit = useCallback((commit: Commit) => {
    if (commit.isWip) {
      resetToGraph();
      return;
    }
    setSelectedCommit(commit);
    setRightPanelMode("commitDetails");
    setMainView("graph");
    setSelectedFile(null);
    setSelectedFileSource(null);
  }, [resetToGraph]);

  const handleSelectWip = useCallback(() => {
    resetToGraph();
  }, [resetToGraph]);

  const handleCloseDiff = useCallback(() => {
    setSelectedFile(null);
    setSelectedFileSource(null);
    setMainView("graph");
  }, []);

  // Expanding the left rail while viewing a file also closes the file view (returns to graph).
  // The auto-expand effect tied to mainView will then open the panel.
  const toggleLeftPanel = useCallback(() => {
    if (leftPanelCollapsed && mainView === "filePreview") {
      handleCloseDiff();
      return;
    }
    setLeftPanelCollapsed((v) => !v);
  }, [leftPanelCollapsed, mainView, handleCloseDiff]);

  const handleOpenFileHistory = useCallback((file: ChangedFile) => {
    setFileHistoryPath(file.path);
  }, []);

  const handleCloseFileHistory = useCallback(() => {
    setFileHistoryPath(null);
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

  const handleDiscardAll = useCallback(async () => {
    if (unstaged.length + staged.length === 0) return;
    setSelectedFile(null);
    setSelectedFileSource(null);
    setMainView("graph");
    await data.discardAll();
    setShowDiscardAllBanner(false);
  }, [data, staged.length, unstaged.length]);

  useEffect(() => {
    if (unstaged.length + staged.length === 0) {
      setShowDiscardAllBanner(false);
    }
  }, [staged.length, unstaged.length]);

  useEffect(() => {
    if (!showCreateBranchBanner && !showRenameBranchBanner) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowCreateBranchBanner(false);
        setShowRenameBranchBanner(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showCreateBranchBanner, showRenameBranchBanner]);

  useEffect(() => {
    if (!fileHistoryPath) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFileHistoryPath(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fileHistoryPath]);

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
    const exactMatch = branchMenuItems.find(({ label }) => label.toLowerCase() === normalizedQuery)?.branch;

    if (exactMatch) {
      await handleBranchMenuSelect(exactMatch);
      return;
    }

    if (filteredBranchMenuItems.length === 1) {
      await handleBranchMenuSelect(filteredBranchMenuItems[0]!.branch);
      return;
    }

    toast.error("Type the full branch name or narrow your search");
  }, [branchMenuItems, branchQuery, filteredBranchMenuItems, handleBranchMenuSelect]);

  const handleCreateBranch = useCallback(async () => {
    setBranchStartPoint(null);
    setBranchNameInput("");
    setShowCreateBranchBanner(true);
  }, []);

  const handleCreateBranchFrom = useCallback(async (fromRef: string) => {
    setBranchStartPoint(fromRef);
    setBranchNameInput("");
    setShowCreateBranchBanner(true);
  }, []);

  const handleSubmitCreateBranch = useCallback(async () => {
    const name = branchNameInput.trim();
    if (!name) {
      toast.error("Branch name is required");
      return;
    }

    await data.createBranch(name, branchStartPoint ?? undefined);
    setShowCreateBranchBanner(false);
    setBranchNameInput("");
    setBranchStartPoint(null);
  }, [branchNameInput, branchStartPoint, data]);

  const handleRequestRenameBranch = useCallback((name: string) => {
    setRenameBranchOldName(name);
    setRenameBranchInput(name);
    setShowRenameBranchBanner(true);
  }, []);

  const handleSubmitRenameBranch = useCallback(async () => {
    const oldName = renameBranchOldName;
    const newName = renameBranchInput.trim();

    if (!oldName) return;
    if (!newName) {
      toast.error("Branch name is required");
      return;
    }
    if (newName === oldName) {
      setShowRenameBranchBanner(false);
      setRenameBranchOldName(null);
      return;
    }

    await data.renameBranch(oldName, newName);
    setShowRenameBranchBanner(false);
    setRenameBranchOldName(null);
    setRenameBranchInput("");
  }, [data, renameBranchInput, renameBranchOldName]);

  const handleDeleteBranch = useCallback(async (refName: string) => {
    await data.deleteBranch(refName);
  }, [data]);

  const handleRenameBranch = useCallback(async (oldName: string, newName: string) => {
    await data.renameBranch(oldName, newName);
  }, [data]);

  const handleStash = useCallback(async () => {
    const base = currentBranch && currentBranch !== "—" ? currentBranch : "stash";
    const message = `#${stashes.length + 1} ${base}`;
    await data.stashPush(message);
  }, [currentBranch, data, stashes.length]);

  const handleToolbarPop = useCallback(async () => {
    if (stashes.length === 0) {
      toast.error("No stashes to pop");
      return;
    }
    await data.stashPop(stashes[0].index);
  }, [data, stashes]);

  const handleStashPop = useCallback(async (index: number) => {
    await data.stashPop(index);
  }, [data]);

  const handleStashApply = useCallback(async (index: number) => {
    await data.stashApply(index);
  }, [data]);

  const handleStashDrop = useCallback(async (index: number) => {
    await data.stashDrop(index);
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

  const handleViewLocalChanges = useCallback(() => {
    setRightPanelMode("localChanges");
    setMainView("graph");
    setSelectedFile(null);
    setSelectedFileSource(null);
  }, []);

  const handleSelectWorktree = useCallback((_worktree: WorktreeInfo) => {
    // TODO: Implement worktree selection
  }, []);

  const handleSwitchWorktree = useCallback(async (worktree: WorktreeInfo) => {
    try {
      const result = await gitClient.switchToWorktree(worktree.path);
      if (result.ok) {
        toast.success(`Switched to worktree: ${worktree.path}`);
        await data.refresh();
      } else {
        toast.error(result.message || "Failed to switch worktree");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to switch worktree");
    }
  }, [data]);

  return (
    <div className={"app" + (showDiscardAllBanner ? " discard-lock" : "")}>
      {showDiscardAllBanner && <div className="discard-ui-lock" aria-hidden="true" />}
      <RepoTabBar
        openRepos={openRepos}
        activePath={activePath}
        onCloseAll={onCloseAll}
        onSwitchRepo={onSwitchRepo}
        onCloseRepo={onCloseRepo}
        onReorderRepo={onReorderRepo}
      />

      <div className="top-controls">
        {showDiscardAllBanner && totalLocalChanges > 0 && (
          <div className="discard-global-banner" role="alertdialog" aria-live="polite">
            <span className="discard-global-banner-text">This will discard staged, unstaged, and untracked files. Are you sure?</span>
            <div className="discard-global-banner-actions">
              <button className="discard-global-banner-btn danger" onClick={() => void handleDiscardAll()}>
                Discard All
              </button>
              <button className="discard-global-banner-btn" onClick={() => setShowDiscardAllBanner(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {showCreateBranchBanner && (
          <form
            className="create-branch-banner"
            role="dialog"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmitCreateBranch();
            }}
          >
            <span className="create-branch-banner-text">
              {branchStartPoint ? `Create branch from ${branchStartPoint}` : "Create branch from current HEAD"}
            </span>
            <input
              className="create-branch-input"
              value={branchNameInput}
              onChange={(event) => setBranchNameInput(event.target.value)}
              placeholder="feature/my-branch"
              autoFocus
            />
            <div className="create-branch-actions">
              <button className="create-branch-btn primary" type="submit">
                Create
              </button>
              <button
                className="create-branch-btn"
                type="button"
                onClick={() => {
                  setShowCreateBranchBanner(false);
                  setBranchNameInput("");
                  setBranchStartPoint(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {showRenameBranchBanner && (
          <form
            className="create-branch-banner"
            role="dialog"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmitRenameBranch();
            }}
          >
            <span className="create-branch-banner-text">
              {renameBranchOldName ? `Rename branch ${renameBranchOldName}` : "Rename branch"}
            </span>
            <input
              className="create-branch-input"
              value={renameBranchInput}
              onChange={(event) => setRenameBranchInput(event.target.value)}
              placeholder="feature/my-branch"
              autoFocus
            />
            <div className="create-branch-actions">
              <button className="create-branch-btn primary" type="submit">
                Rename
              </button>
              <button
                className="create-branch-btn"
                type="button"
                onClick={() => {
                  setShowRenameBranchBanner(false);
                  setRenameBranchOldName(null);
                  setRenameBranchInput("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <RepoToolbar
          repoName={repoName}
          currentBranch={currentBranch}
          statusAhead={status?.unpushed ?? status?.ahead ?? 0}
          statusBehind={status?.behind || 0}
          stashCount={stashes.length}
          localBranches={localBranches}
          remoteBranches={remoteBranches}
          currentBranchId={currentBranchId}
          branchMenuRef={branchMenuRef}
          isBranchMenuOpen={isBranchMenuOpen}
          branchQuery={branchQuery}
          filteredBranchMenuItems={filteredBranchMenuItems}
          onToggleBranchMenu={() => setIsBranchMenuOpen((open) => !open)}
          onBranchQueryChange={setBranchQuery}
          onBranchSubmit={() => void handleBranchMenuSubmit()}
          onBranchSelect={(branch) => void handleBranchMenuSelect(branch)}
          onPull={() => void data.pull()}
          onPush={() => void data.push()}
          onCreateBranch={() => void handleCreateBranch()}
          onStash={() => void handleStash()}
          onPop={() => void handleToolbarPop()}
          onToggleTerminal={() => setIsTerminalOpen((open) => !open)}
        />
      </div>

      <div
        className={
          "workarea" +
          (leftPanelCollapsed ? " left-collapsed" : "") +
          (rightPanelCollapsed ? " right-collapsed" : "")
        }
        style={workareaStyle}
      >
        {fileHistoryPath ? (
          <FileHistoryWorkspace
            repoPath={repoPath}
            filePath={fileHistoryPath}
            diffMode={diffMode}
            onChangeDiffMode={setDiffMode}
            onClose={handleCloseFileHistory}
          />
        ) : (
          <>
            <BranchSidebar
              localBranches={localBranches}
              remoteBranches={remoteBranches}
              worktrees={worktrees}
              repoPath={repoPath}
              currentBranchId={currentBranchId}
              onSelectBranch={handleSelectBranch}
              onCheckoutBranch={handleCheckoutBranch}
              onCreateBranchFrom={(refName) => void handleCreateBranchFrom(refName)}
              onDeleteBranch={(refName) => void handleDeleteBranch(refName)}
              onRequestRenameBranch={handleRequestRenameBranch}
              onWorktreeCreated={refreshWorktrees}
              onSelectWorktree={(wt) => void handleSelectWorktree(wt)}
              onSwitchWorktree={(wt) => void handleSwitchWorktree(wt)}
              onDeleteWorktree={deleteWorktree.open}
              onOpenInFinder={openInFinder}
              onPruneWorktree={pruneWorktree}
              collapsed={leftPanelCollapsed}
              onToggleCollapsed={toggleLeftPanel}
              onStartResize={leftPanel.startResize}
            />
            <DeleteWorktreeDialog
              isOpen={deleteWorktree.isOpen}
              worktree={deleteWorktree.worktree}
              loading={deleteWorktree.loading}
              error={deleteWorktree.error}
              onClose={deleteWorktree.close}
              onConfirm={() => void deleteWorktree.delete()}
            />

            <div className="center">
              <CommitGraph
                commits={commits}
                selectedCommitId={selectedCommit?.id}
                onSelectCommit={handleSelectCommit}
                onSelectWip={handleSelectWip}
                onCheckoutRef={(refName) => void handleCheckoutRef(refName)}
                onCreateBranchFrom={(refName) => void handleCreateBranchFrom(refName)}
                onDeleteBranch={(refName) => void handleDeleteBranch(refName)}
                onRequestRenameBranch={handleRequestRenameBranch}
                onStashPop={(index) => void handleStashPop(index)}
                onStashApply={(index) => void handleStashApply(index)}
                onStashDrop={(index) => void handleStashDrop(index)}
                onCherryPick={(hash) => void data.cherryPick(hash)}
                onRevertCommit={(hash) => void data.revertCommit(hash)}
                onLoadMore={() => void data.loadMoreHistory()}
                loadingMore={data.loadingMoreHistory}
                historyDone={data.data.historyDone}
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
                  onShowHistory={() => handleOpenFileHistory(selectedFile)}
                />
              )}
              {isTerminalOpen && (
                <TerminalPanel
                  repoPath={repoPath}
                  height={terminalHeight}
                  onResize={setTerminalHeight}
                  onClose={() => setIsTerminalOpen(false)}
                />
              )}
            </div>

            <RightPanel
              repoPath={repoPath}
              mode={rightPanelMode}
              selectedCommit={selectedCommit}
              commitFiles={commitFiles}
              selectedFileId={selectedFile?.id}
              unstagedFiles={unstaged}
              stagedFiles={staged}
              currentBranch={currentBranch}
              totalLocalChanges={totalLocalChanges}
              onSelectFile={handleSelectFile}
              onStageFile={handleStageFile}
              onUnstageFile={handleUnstageFile}
              onStageAll={handleStageAll}
              onUnstageAll={handleUnstageAll}
              onRequestDiscardAll={() => setShowDiscardAllBanner(true)}
              onCommit={handleCommit}
              onViewLocalChanges={handleViewLocalChanges}
              collapsed={rightPanelCollapsed}
              onToggleCollapsed={toggleRightPanel}
              onStartResize={rightPanel.startResize}
            />
          </>
        )}
      </div>

      <RepoStatusBar
        commitCount={history.length}
        branchCount={localBranches.length}
        totalLocalChanges={totalLocalChanges}
        operationState={status?.state.operationState}
        repoPath={repoPath}
      />
    </div>
  );
}
