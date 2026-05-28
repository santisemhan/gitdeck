import { useEffect, useRef } from "react";
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setTimeout(() => {
        dialogRef.current?.focus();
      }, 0);
    }
    return () => {
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !worktree) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="dialog-header">
          <h3 id="dialog-title">Delete Worktree</h3>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </div>
        <div className="dialog-body">
          <div className="delete-warning">
            <p>Are you sure you want to delete this worktree?</p>
            <div className="worktree-info">
              <p><strong>Path:</strong> {worktree.path}</p>
              {worktree.branch && <p><strong>Branch:</strong> {worktree.branch}</p>}
            </div>
            {worktree.hasChanges && (
              <div className="warning-message">
                This worktree has uncommitted changes. Deleting it will discard all changes.
              </div>
            )}
          </div>
          {error && <div className="form-error">{error}</div>}
        </div>
        <div className="dialog-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
