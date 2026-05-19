interface TopToolbarProps {
  repoPath: string;
  busy: boolean;
  onOpenRepo: () => void;
  onRefresh: () => void;
  onPull: () => void;
  onPush: () => void;
  onBranch: () => void;
}

export function TopToolbar({ repoPath, busy, onOpenRepo, onRefresh, onPull, onPush, onBranch }: TopToolbarProps) {
  return (
    <header className="top-toolbar">
      <div className="toolbar-left">
        <button className="back-button" title="Back to repository launcher" onClick={onOpenRepo}>←</button>
        <strong>GitDeck</strong>
        <span className="repo-path" title={repoPath}>{repoPath || "No repository selected"}</span>
      </div>
      <div className="toolbar-actions">
        <button title="Refresh (R)" disabled={!repoPath || busy} onClick={onRefresh}>Refresh</button>
        <button title="Pull" disabled={!repoPath || busy} onClick={onPull}>Pull</button>
        <button title="Push" disabled={!repoPath || busy} onClick={onPush}>Push</button>
        <button title="Create branch" disabled={!repoPath || busy} onClick={onBranch}>Branch</button>
      </div>
    </header>
  );
}
