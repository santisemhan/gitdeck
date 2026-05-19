import { GitCommit } from "../../shared/types";

interface CommitContextMenuProps {
  x: number;
  y: number;
  commit: GitCommit;
  onCherryPick: (hash: string) => void;
  onBranchFromCommit: (hash: string) => void;
  onCopyHash: (hash: string) => void;
  onViewDetails: (commit: GitCommit) => void;
  onClose: () => void;
}

export function CommitContextMenu(props: CommitContextMenuProps) {
  const { x, y, commit, onCherryPick, onBranchFromCommit, onCopyHash, onViewDetails, onClose } = props;

  return (
    <div className="context-backdrop" onClick={onClose}>
      <div className="context-menu" style={{ top: y, left: x }} onClick={(e) => e.stopPropagation()}>
        <button onClick={() => { onCherryPick(commit.hash); onClose(); }}>Cherry-pick commit</button>
        <button onClick={() => { onBranchFromCommit(commit.hash); onClose(); }}>Create branch from commit</button>
        <button onClick={() => { onCopyHash(commit.hash); onClose(); }}>Copy commit hash</button>
        <button onClick={() => { onViewDetails(commit); onClose(); }}>View commit details</button>
      </div>
    </div>
  );
}
