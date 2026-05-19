import type {
  CommitDetails,
  EditorOperationResult,
  GitBranch,
  GitDiff,
  GitOperationResult,
  GitStatus,
  Repository
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
      commit(repoPath: string, message: string): Promise<GitOperationResult>;
      getHistory(repoPath: string): Promise<any[]>;
      getCommitDetails(repoPath: string, commitHash: string): Promise<CommitDetails>;
      getBranches(repoPath: string): Promise<GitBranch[]>;
      checkoutBranch(repoPath: string, branch: string): Promise<GitOperationResult>;
      checkoutRemoteBranch(repoPath: string, remoteBranch: string): Promise<GitOperationResult>;
      createBranch(repoPath: string, branch: string, startPoint?: string): Promise<GitOperationResult>;
      pull(repoPath: string): Promise<GitOperationResult>;
      push(repoPath: string): Promise<GitOperationResult>;
      cherryPick(repoPath: string, commitHash: string): Promise<GitOperationResult>;
      continueCherryPick(repoPath: string): Promise<GitOperationResult>;
      abortCherryPick(repoPath: string): Promise<GitOperationResult>;
      isVSCodeAvailable(): Promise<boolean>;
      openFileInVSCode(filePath: string): Promise<EditorOperationResult>;
      openRepositoryInVSCode(repoPath: string): Promise<EditorOperationResult>;
    };
  }
}

export {};
