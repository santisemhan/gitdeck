import type {
  CommitDetails,
  FileHistoryEntry,
  GitBranch,
  GitCommit,
  GitDiff,
  GitSplitContent,
  GitOperationResult,
  GitStashEntry,
  TerminalCreateResult,
  TerminalDataEvent,
  TerminalExitEvent,
  RepoChangeEvent,
  GitStatus,
  Repository,
  WatchOperationResult,
  WorktreeInfo
} from "../../../shared/types";

const api = () => window.gitdeck;

export interface OpenRepoResult {
  ok: boolean;
  path?: string;
  name?: string;
  message?: string;
}

export interface SelectDirectoryResult {
  ok: boolean;
  path?: string;
  message?: string;
}

const BRIDGE_OUTDATED = "This action is not available yet. Restart the app to reload preload/main changes.";

export const gitClient = {
  selectRepository(): Promise<OpenRepoResult> {
    return api().selectRepository();
  },
  selectDirectory(): Promise<SelectDirectoryResult> {
    const bridge = api() as Window["gitdeck"] & { selectDirectory?: () => Promise<SelectDirectoryResult> };
    if (typeof bridge.selectDirectory !== "function") {
      return Promise.resolve({ ok: false, message: BRIDGE_OUTDATED });
    }
    return bridge.selectDirectory();
  },
  cloneRepository(url: string, parentDir: string): Promise<OpenRepoResult> {
    const bridge = api() as Window["gitdeck"] & { cloneRepository?: (url: string, parentDir: string) => Promise<OpenRepoResult> };
    if (typeof bridge.cloneRepository !== "function") {
      return Promise.resolve({ ok: false, message: BRIDGE_OUTDATED });
    }
    return bridge.cloneRepository(url, parentDir);
  },
  initRepository(targetPath: string): Promise<OpenRepoResult> {
    const bridge = api() as Window["gitdeck"] & { initRepository?: (targetPath: string) => Promise<OpenRepoResult> };
    if (typeof bridge.initRepository !== "function") {
      return Promise.resolve({ ok: false, message: BRIDGE_OUTDATED });
    }
    return bridge.initRepository(targetPath);
  },
  recentRepositories(): Promise<Repository[]> {
    return api().getRecentRepositories();
  },
  status(repoPath: string): Promise<GitStatus> {
    return api().getStatus(repoPath);
  },
  history(repoPath: string, opts?: { limit?: number; skip?: number }): Promise<GitCommit[]> {
    return api().getHistory(repoPath, opts);
  },
  fileHistory(repoPath: string, filePath: string, opts?: { limit?: number; skip?: number }): Promise<FileHistoryEntry[]> {
    return api().getFileHistory(repoPath, filePath, opts);
  },
  branches(repoPath: string): Promise<GitBranch[]> {
    return api().getBranches(repoPath);
  },
  tags(repoPath: string): Promise<string[]> {
    return api().getTags(repoPath);
  },
  diff(repoPath: string, filePath: string, staged: boolean): Promise<GitDiff> {
    return api().getDiff(repoPath, filePath, staged);
  },
  commitFileDiff(repoPath: string, hash: string, filePath: string): Promise<GitDiff> {
    return api().getCommitFileDiff(repoPath, hash, filePath);
  },
  fileContent(repoPath: string, filePath: string, source: "unstaged" | "staged" | "commit", commitHash?: string): Promise<{ text: string; isBinary: boolean }> {
    return api().getFileContent(repoPath, filePath, source, commitHash);
  },
  splitContent(repoPath: string, filePath: string, source: "unstaged" | "staged" | "commit", commitHash?: string): Promise<GitSplitContent> {
    return api().getSplitContent(repoPath, filePath, source, commitHash);
  },
  commitDetails(repoPath: string, hash: string): Promise<CommitDetails> {
    return api().getCommitDetails(repoPath, hash);
  },
  stageFile(repoPath: string, filePath: string): Promise<GitOperationResult> {
    return api().stageFile(repoPath, filePath);
  },
  unstageFile(repoPath: string, filePath: string): Promise<GitOperationResult> {
    return api().unstageFile(repoPath, filePath);
  },
  stageAll(repoPath: string): Promise<GitOperationResult> {
    return api().stageAll(repoPath);
  },
  unstageAll(repoPath: string): Promise<GitOperationResult> {
    return api().unstageAll(repoPath);
  },
  discardFile(repoPath: string, filePath: string, source: "unstaged" | "staged"): Promise<GitOperationResult> {
    const bridge = api() as Window["gitdeck"] & { discardFile?: (repoPath: string, filePath: string, source: "unstaged" | "staged") => Promise<GitOperationResult> };
    if (typeof bridge.discardFile !== "function") {
      return Promise.resolve({
        ok: false,
        code: 1,
        stdout: "",
        stderr: "",
        message: "Discard file is not available yet. Restart the app to reload preload/main changes."
      });
    }
    return bridge.discardFile(repoPath, filePath, source);
  },
  discardAll(repoPath: string): Promise<GitOperationResult> {
    const bridge = api() as Window["gitdeck"] & { discardAll?: (repoPath: string) => Promise<GitOperationResult> };
    if (typeof bridge.discardAll !== "function") {
      return Promise.resolve({
        ok: false,
        code: 1,
        stdout: "",
        stderr: "",
        message: "Discard all is not available yet. Restart the app to reload preload/main changes."
      });
    }
    return bridge.discardAll(repoPath);
  },
  commit(repoPath: string, message: string): Promise<GitOperationResult> {
    return api().commit(repoPath, message);
  },
  pull(repoPath: string): Promise<GitOperationResult> {
    return api().pull(repoPath);
  },
  push(repoPath: string): Promise<GitOperationResult> {
    return api().push(repoPath);
  },
  checkoutBranch(repoPath: string, name: string): Promise<GitOperationResult> {
    return api().checkoutBranch(repoPath, name);
  },
  checkoutRemoteBranch(repoPath: string, remoteBranch: string): Promise<GitOperationResult> {
    return api().checkoutRemoteBranch(repoPath, remoteBranch);
  },
  createBranch(repoPath: string, name: string, startPoint?: string): Promise<GitOperationResult> {
    return api().createBranch(repoPath, name, startPoint);
  },
  createTag(repoPath: string, name: string, startPoint?: string): Promise<GitOperationResult> {
    return api().createTag(repoPath, name, startPoint);
  },
  pushTag(repoPath: string, name: string): Promise<GitOperationResult> {
    return api().pushTag(repoPath, name);
  },
  deleteBranch(repoPath: string, name: string): Promise<GitOperationResult> {
    return api().deleteBranch(repoPath, name);
  },
  renameBranch(repoPath: string, oldName: string, newName: string): Promise<GitOperationResult> {
    return api().renameBranch(repoPath, oldName, newName);
  },
  mergeBranch(repoPath: string, source: string, target: string): Promise<GitOperationResult> {
    return api().mergeBranch(repoPath, source, target);
  },
  stashList(repoPath: string): Promise<GitStashEntry[]> {
    return api().stashList(repoPath);
  },
  stashPush(repoPath: string, message: string): Promise<GitOperationResult> {
    return api().stashPush(repoPath, message);
  },
  stashPop(repoPath: string, index: number): Promise<GitOperationResult> {
    return api().stashPop(repoPath, index);
  },
  stashApply(repoPath: string, index: number): Promise<GitOperationResult> {
    return api().stashApply(repoPath, index);
  },
  stashDrop(repoPath: string, index: number): Promise<GitOperationResult> {
    return api().stashDrop(repoPath, index);
  },
  cherryPick(repoPath: string, hash: string): Promise<GitOperationResult> {
    return api().cherryPick(repoPath, hash);
  },
  revertCommit(repoPath: string, hash: string): Promise<GitOperationResult> {
    return api().revertCommit(repoPath, hash);
  },
  watchRepository(repoPath: string): Promise<WatchOperationResult> {
    return api().watchRepository(repoPath);
  },
  unwatchRepository(): Promise<WatchOperationResult> {
    return api().unwatchRepository();
  },
  onRepositoryChanged(listener: (event: RepoChangeEvent) => void): () => void {
    return api().onRepositoryChanged(listener);
  },
  openRepoInVSCode(repoPath: string) {
    return api().openRepositoryInVSCode(repoPath);
  },
  terminalCreate(repoPath: string, cols: number, rows: number): Promise<TerminalCreateResult> {
    return api().terminalCreate(repoPath, cols, rows);
  },
  terminalInput(sessionId: string, data: string): Promise<{ ok: boolean }> {
    return api().terminalInput(sessionId, data);
  },
  terminalResize(sessionId: string, cols: number, rows: number): Promise<{ ok: boolean }> {
    return api().terminalResize(sessionId, cols, rows);
  },
  terminalClose(sessionId: string): Promise<{ ok: boolean }> {
    return api().terminalClose(sessionId);
  },
  onTerminalData(listener: (event: TerminalDataEvent) => void): () => void {
    return api().onTerminalData(listener);
  },
  onTerminalExit(listener: (event: TerminalExitEvent) => void): () => void {
    return api().onTerminalExit(listener);
  },
  listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
    return api().worktree.list(repoPath);
  },
  createWorktree(repoPath: string, branch: string, targetPath: string, createNewBranch?: boolean): Promise<GitOperationResult> {
    return api().worktree.create(repoPath, branch, targetPath, createNewBranch);
  },
  deleteWorktree(repoPath: string, worktreePath: string): Promise<GitOperationResult> {
    return api().worktree.delete(repoPath, worktreePath);
  },
  moveWorktree(repoPath: string, oldPath: string, newPath: string): Promise<GitOperationResult> {
    return api().worktree.move(repoPath, oldPath, newPath);
  },
  pruneWorktree(repoPath: string, worktreePath: string): Promise<GitOperationResult> {
    return api().worktree.prune(repoPath, worktreePath);
  },
  openInFinder(worktreePath: string): Promise<GitOperationResult> {
    return api().worktree.openInFinder(worktreePath);
  },
  switchToWorktree(worktreePath: string): Promise<GitOperationResult> {
    return api().worktree.switch(worktreePath);
  }
};

export function describeError(message: string | undefined, fallback: string): string {
  const m = (message || "").trim();
  return m.length > 0 ? m : fallback;
}
