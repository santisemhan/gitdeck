import type { WorktreeInfo } from "../../../shared/types";

interface DeleteWorktreeDialogProps {
  isOpen: boolean;
  worktree: WorktreeInfo | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteWorktreeDialog({
  isOpen,
  worktree,
  loading,
  error,
  onClose,
  onConfirm,
}: DeleteWorktreeDialogProps) {
  if (!isOpen || !worktree) return null;

  const worktreeName = worktree.branch || worktree.path.split("/").pop() || "worktree";

  return (
    <div className="discard-global-banner" role="alertdialog" aria-live="polite">
      <span className="discard-global-banner-text">
        Delete worktree {worktreeName}?
        {worktree.hasChanges && " This worktree has uncommitted changes."}
      </span>
      {error && <span className="discard-global-banner-text" style={{ color: "#ff6b6b" }}>{error}</span>}
      <div className="discard-global-banner-actions">
        <button
          className="discard-global-banner-btn danger"
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? "Deleting..." : "Delete"}
        </button>
        <button
          className="discard-global-banner-btn"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
