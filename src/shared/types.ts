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
  additions?: number;
  deletions?: number;
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

export interface GitSplitContent {
  oldText: string;
  newText: string;
  isBinary: boolean;
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
  parents: string[];
  body: string;
}

export interface GitStashEntry {
  index: number;
  hash: string;
  parentHash: string;
  message: string;
  branch: string;
  dateISO: string;
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

export interface WatchOperationResult {
  ok: boolean;
  message?: string;
}

export interface RepoChangeEvent {
  repoPath: string;
  changedAt: number;
}

export interface CommitDetails {
  commit: GitCommit;
  files: GitFileChange[];
  patch: string;
  parentHashes: string[];
}

export type FileStatus = GitFileKind;
export type DiffMode = "split" | "inline";
export type MainView = "graph" | "filePreview";
export type RightPanelMode = "localChanges" | "commitDetails";
export type SelectedFileSource = "commit" | "unstaged" | "staged";

export interface DiffLine {
  type: "header" | "hunk" | "add" | "del" | "context";
  leftNumber: number | null;
  rightNumber: number | null;
  text: string;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}
