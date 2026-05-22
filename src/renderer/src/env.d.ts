import type {
  CommitDetails,
  EditorOperationResult,
  RepoChangeEvent,
  GitBranch,
  GitDiff,
  GitSplitContent,
  GitOperationResult,
  GitStashEntry,
  GitStatus,
  Repository,
  WatchOperationResult
} from "../../shared/types";

declare global {
  interface Window {
    gitdeck: {
      selectRepository(): Promise<any>;
      getRecentRepositories(): Promise<Repository[]>;
      getStatus(repoPath: string): Promise<GitStatus>;
      getDiff(repoPath: string, filePath: string, staged: boolean): Promise<GitDiff>;
      stageFile(repoPath: string, filePath: string): Promise<GitOperationResult>;
      unstageFile(repoPath: string, filePath: string): Promise<GitOperationResult>;
      stageAll(repoPath: string): Promise<GitOperationResult>;
      unstageAll(repoPath: string): Promise<GitOperationResult>;
      discardAll(repoPath: string): Promise<GitOperationResult>;
      commit(repoPath: string, message: string): Promise<GitOperationResult>;
      getHistory(repoPath: string): Promise<any[]>;
      getCommitDetails(repoPath: string, commitHash: string): Promise<CommitDetails>;
      getCommitFileDiff(repoPath: string, commitHash: string, filePath: string): Promise<GitDiff>;
      getFileContent(repoPath: string, filePath: string, source: string, commitHash?: string): Promise<{ text: string; isBinary: boolean }>;
      getSplitContent(repoPath: string, filePath: string, source: string, commitHash?: string): Promise<GitSplitContent>;
      getBranches(repoPath: string): Promise<GitBranch[]>;
      checkoutBranch(repoPath: string, branch: string): Promise<GitOperationResult>;
      checkoutRemoteBranch(repoPath: string, remoteBranch: string): Promise<GitOperationResult>;
      createBranch(repoPath: string, branch: string, startPoint?: string): Promise<GitOperationResult>;
      deleteBranch(repoPath: string, name: string): Promise<GitOperationResult>;
      renameBranch(repoPath: string, oldName: string, newName: string): Promise<GitOperationResult>;
      pull(repoPath: string): Promise<GitOperationResult>;
      push(repoPath: string): Promise<GitOperationResult>;
      cherryPick(repoPath: string, commitHash: string): Promise<GitOperationResult>;
      continueCherryPick(repoPath: string): Promise<GitOperationResult>;
      abortCherryPick(repoPath: string): Promise<GitOperationResult>;
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
    };
  }
}

export {};
