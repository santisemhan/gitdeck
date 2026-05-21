interface RepoStatusBarProps {
  commitCount: number;
  branchCount: number;
  totalLocalChanges: number;
  operationState?: string;
  repoPath: string;
}

export function RepoStatusBar({ commitCount, branchCount, totalLocalChanges, operationState, repoPath }: RepoStatusBarProps) {
  return (
    <div className="statusbar">
      <span className="item">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <rect width="10" height="10" rx="2" fill="var(--bg-3)" />
          <path d="M3 5h4M5 3v4" stroke="var(--text-3)" strokeWidth="1.2" />
        </svg>
        {commitCount} commits
      </span>
      <span className="item">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <circle cx="5" cy="5" r="4" stroke="var(--text-3)" strokeWidth="1.2" />
        </svg>
        {branchCount} branches
      </span>
      {totalLocalChanges > 0 && <span className="item status-modified">{totalLocalChanges} changed</span>}
      {operationState && operationState !== "normal" && <span className="item status-error">{operationState}</span>}
      <div className="right">
        <span className="item">{repoPath}</span>
      </div>
    </div>
  );
}
