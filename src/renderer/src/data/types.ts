export type FileStatus = "added" | "modified" | "deleted" | "renamed";

export interface ChangedFile {
  id: string;
  path: string;
  status: FileStatus;
  renamedFrom?: string;
  additions: number;
  deletions: number;
  oldText: string;
  newText: string;
}

export interface CommitRef {
  kind: "branch" | "tag" | "more";
  name?: string;
  current?: boolean;
  count?: number;
  /** Remote name if this branch has a remote-tracking ref (e.g. "origin") */
  remote?: string;
  /** Whether a local branch with this name exists. Defaults to true when remote is unset. */
  hasLocal?: boolean;
}

export interface Commit {
  id: string;
  hash: string;
  title: string;
  body?: string;
  author: string;
  email: string;
  dateISO: string;
  parents: string[];
  parentsLanes: number[];
  refs?: CommitRef[];
  lane: number;
  isWip?: boolean;
  isMerge?: boolean;
  isStash?: boolean;
  stashIndex?: number;
  stashMessage?: string;
  additions?: number;
}

export interface LocalBranch {
  id: string;
  name: string;
  type: "local";
  current?: boolean;
  ahead: number;
  behind: number;
  lastActivity: string;
  folder?: string;
}

export interface RemoteBranch {
  id: string;
  name: string;
  type: "remote";
  remote: string;
  folder?: string;
  isFolder?: boolean;
  children?: RemoteBranch[];
}

export type AnyBranch = LocalBranch | RemoteBranch;

export interface Repository {
  id: string;
  name: string;
  path: string;
  currentBranch: string;
}

export type DiffMode = "split" | "inline";
export type MainView = "graph" | "filePreview";
export type RightPanelMode = "localChanges" | "commitDetails";
export type SelectedFileSource = "commit" | "unstaged" | "staged";
