export type RepositoryOperationState =
  | "normal"
  | "detached-head"
  | "merge-in-progress"
  | "rebase-in-progress"
  | "cherry-pick-in-progress";

export interface Repository {
  path: string;
  name: string;
  lastOpenedAt: string;
}

export type GitFileKind = "modified" | "added" | "deleted" | "renamed" | "copied" | "untracked" | "conflicted";

export interface GitFileChange {
  path: string;
  oldPath?: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
  conflicted: boolean;
  kind: GitFileKind;
}

export interface GitConflictState {
  hasConflicts: boolean;
  files: string[];
}

export interface RepositoryState {
  operationState: RepositoryOperationState;
  detachedHead: boolean;
  mergeInProgress: boolean;
  rebaseInProgress: boolean;
  cherryPickInProgress: boolean;
}

export interface GitStatus {
  repoPath: string;
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
  clean: boolean;
  state: RepositoryState;
  conflicts: GitConflictState;
  changes: GitFileChange[];
}

export interface GitDiff {
  path: string;
  staged: boolean;
  isBinary: boolean;
  tooLarge: boolean;
  text: string;
}

export interface GitBranch {
  name: string;
  current: boolean;
  remote: boolean;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  date: string;
  subject: string;
  refs: string;
}

export interface GitOperationResult {
  ok: boolean;
  code: number;
  stdout: string;
  stderr: string;
  message?: string;
}

export interface EditorOperationResult {
  ok: boolean;
  message: string;
}

export interface CommitDetails {
  commit: GitCommit;
  files: GitFileChange[];
  patch: string;
}
