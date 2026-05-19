import type {
  CommitDetails,
  GitBranch,
  GitCommit,
  GitDiff,
  GitOperationResult,
  GitStatus,
  Repository
} from "../../../shared/types";

const api = () => window.gitdeck;

export interface OpenRepoResult {
  ok: boolean;
  path?: string;
  name?: string;
  message?: string;
}

export const gitClient = {
  selectRepository(): Promise<OpenRepoResult> {
    return api().selectRepository();
  },
  recentRepositories(): Promise<Repository[]> {
    return api().getRecentRepositories();
  },
  status(repoPath: string): Promise<GitStatus> {
    return api().getStatus(repoPath);
  },
  history(repoPath: string): Promise<GitCommit[]> {
    return api().getHistory(repoPath);
  },
  branches(repoPath: string): Promise<GitBranch[]> {
    return api().getBranches(repoPath);
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
  openRepoInVSCode(repoPath: string) {
    return api().openRepositoryInVSCode(repoPath);
  }
};

export function describeError(message: string | undefined, fallback: string): string {
  const m = (message || "").trim();
  return m.length > 0 ? m : fallback;
}
