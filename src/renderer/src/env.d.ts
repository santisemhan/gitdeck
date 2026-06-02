import type {
  CommitDetails,
  EditorOperationResult,
  FileHistoryEntry,
  RepoChangeEvent,
  GitBranch,
  GitDiff,
  GitSplitContent,
  GitOperationResult,
  GitStashEntry,
  GitStatus,
  Repository,
  TerminalCreateResult,
  TerminalDataEvent,
  TerminalExitEvent,
  WatchOperationResult,
  WorktreeInfo
} from "../../shared/types";

declare global {
  interface Window {
    gitdeck: {
      getAppVersion(): Promise<string>;
      selectRepository(): Promise<any>;
      selectDirectory(): Promise<{ ok: boolean; path?: string; message?: string }>;
      cloneRepository(url: string, parentDir: string): Promise<{ ok: boolean; path?: string; name?: string; message?: string }>;
      initRepository(targetPath: string): Promise<{ ok: boolean; path?: string; name?: string; message?: string }>;
      getRecentRepositories(): Promise<Repository[]>;
      getStatus(repoPath: string): Promise<GitStatus>;
      getDiff(repoPath: string, filePath: string, staged: boolean): Promise<GitDiff>;
      stageFile(repoPath: string, filePath: string): Promise<GitOperationResult>;
      unstageFile(repoPath: string, filePath: string): Promise<GitOperationResult>;
      stageAll(repoPath: string): Promise<GitOperationResult>;
      unstageAll(repoPath: string): Promise<GitOperationResult>;
      discardFile(repoPath: string, filePath: string, source: "unstaged" | "staged"): Promise<GitOperationResult>;
      discardAll(repoPath: string): Promise<GitOperationResult>;
      commit(repoPath: string, message: string): Promise<GitOperationResult>;
      getHistory(repoPath: string, opts?: { limit?: number; skip?: number }): Promise<any[]>;
      getFileHistory(repoPath: string, filePath: string, opts?: { limit?: number; skip?: number }): Promise<FileHistoryEntry[]>;
      getCommitDetails(repoPath: string, commitHash: string): Promise<CommitDetails>;
      getCommitFileDiff(repoPath: string, commitHash: string, filePath: string): Promise<GitDiff>;
      getFileContent(repoPath: string, filePath: string, source: string, commitHash?: string): Promise<{ text: string; isBinary: boolean }>;
      getSplitContent(repoPath: string, filePath: string, source: string, commitHash?: string): Promise<GitSplitContent>;
      getBranches(repoPath: string): Promise<GitBranch[]>;
      checkoutBranch(repoPath: string, branch: string): Promise<GitOperationResult>;
      checkoutRemoteBranch(repoPath: string, remoteBranch: string): Promise<GitOperationResult>;
      createBranch(repoPath: string, branch: string, startPoint?: string): Promise<GitOperationResult>;
      createTag(repoPath: string, tag: string, startPoint?: string): Promise<GitOperationResult>;
      pushTag(repoPath: string, tag: string): Promise<GitOperationResult>;
      deleteBranch(repoPath: string, name: string): Promise<GitOperationResult>;
      renameBranch(repoPath: string, oldName: string, newName: string): Promise<GitOperationResult>;
      mergeBranch(repoPath: string, source: string, target: string): Promise<GitOperationResult>;
      pull(repoPath: string): Promise<GitOperationResult>;
      push(repoPath: string): Promise<GitOperationResult>;
      cherryPick(repoPath: string, commitHash: string): Promise<GitOperationResult>;
      continueCherryPick(repoPath: string): Promise<GitOperationResult>;
      abortCherryPick(repoPath: string): Promise<GitOperationResult>;
      revertCommit(repoPath: string, hash: string): Promise<GitOperationResult>;
      stashList(repoPath: string): Promise<GitStashEntry[]>;
      stashPush(repoPath: string, message: string): Promise<GitOperationResult>;
      stashPop(repoPath: string, index: number): Promise<GitOperationResult>;
      stashApply(repoPath: string, index: number): Promise<GitOperationResult>;
      stashDrop(repoPath: string, index: number): Promise<GitOperationResult>;
      watchRepository(repoPath: string): Promise<WatchOperationResult>;
      unwatchRepository(): Promise<WatchOperationResult>;
      onRepositoryChanged(listener: (event: RepoChangeEvent) => void): () => void;
      isVSCodeAvailable(): Promise<boolean>;
      openFileInVSCode(filePath: string): Promise<EditorOperationResult>;
      openRepositoryInVSCode(repoPath: string): Promise<EditorOperationResult>;
      terminalCreate(repoPath: string, cols: number, rows: number): Promise<TerminalCreateResult>;
      terminalInput(sessionId: string, data: string): Promise<{ ok: boolean }>;
      terminalResize(sessionId: string, cols: number, rows: number): Promise<{ ok: boolean }>;
      terminalClose(sessionId: string): Promise<{ ok: boolean }>;
      onTerminalData(listener: (event: TerminalDataEvent) => void): () => void;
      onTerminalExit(listener: (event: TerminalExitEvent) => void): () => void;
      worktree: {
        list(repoPath: string): Promise<WorktreeInfo[]>;
        create(repoPath: string, branch: string, targetPath: string, createNewBranch?: boolean): Promise<GitOperationResult>;
        delete(repoPath: string, worktreePath: string): Promise<GitOperationResult>;
        move(repoPath: string, oldPath: string, newPath: string): Promise<GitOperationResult>;
        prune(repoPath: string, worktreePath: string): Promise<GitOperationResult>;
        openInFinder(worktreePath: string): Promise<GitOperationResult>;
        switch(worktreePath: string): Promise<GitOperationResult>;
      };
    };
  }
}

export {};
