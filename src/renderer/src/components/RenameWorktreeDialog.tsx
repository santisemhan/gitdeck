import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { gitClient } from "../services/gitClient";

interface RenameWorktreeDialogProps {
  isOpen: boolean;
  worktreePath: string;
  repoPath: string;
  onClose: () => void;
  onRenamed: () => void;
}

export function RenameWorktreeDialog({
  isOpen,
  worktreePath,
  repoPath,
  onClose,
  onRenamed,
}: RenameWorktreeDialogProps) {
  const [newPath, setNewPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // default new path is current path with "-renamed" suffix
  const defaultNewPath = useCallback(() => {
    if (!worktreePath) return "";
    const normalized = worktreePath.replace(/[\\/]+$/, "");
    return `${normalized}-renamed`;
  }, [worktreePath]);

  useEffect(() => {
    if (isOpen && worktreePath) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setNewPath(defaultNewPath());
      setError(null);
      setTimeout(() => {
        dialogRef.current?.focus();
      }, 0);
    }
    return () => {
      previousFocusRef.current?.focus();
    };
  }, [isOpen, worktreePath, defaultNewPath]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const validatePath = (path: string): string | null => {
    if (!path.trim()) return "Target path is required";
    const normalized = path.replace(/[\\/]+$/, "").toLowerCase();
    const repoNorm = repoPath.replace(/[\\/]+$/, "").toLowerCase();
    if (normalized === repoNorm) return "Cannot rename worktree to repository root";
    if (normalized.startsWith(repoNorm + "/") || normalized.startsWith(repoNorm + "\\"))
      return "Cannot rename worktree inside repository directory";
    if (path.includes("..") || path.includes("~")) return "Path contains invalid characters";
    return null;
  };

  const checkPathExists = async (path: string): Promise<boolean> => {
    try {
      const list = await gitClient.listWorktrees(repoPath);
      return list.some((w) => w.path.replace(/[\\/]+$/, "").toLowerCase() === path.replace(/[\\/]+$/, "").toLowerCase());
    } catch {
      return false;
    }
  };

  const handleRename = async () => {
    const validation = validatePath(newPath);
    if (validation) {
      setError(validation);
      toast.error(validation);
      return;
    }
    if (await checkPathExists(newPath)) {
      const msg = "Target path already exists";
      setError(msg);
      toast.error(msg);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await gitClient.moveWorktree(repoPath, worktreePath, newPath);
      if (result.ok) {
        toast.success(`Worktree renamed to ${newPath}`);
        onRenamed();
        onClose();
      } else {
        const msg = result.message || "Failed to rename worktree";
        setError(msg);
        toast.error(msg);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to rename worktree";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) {
      handleRename();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-dialog-title"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="dialog-header">
          <h3 id="rename-dialog-title">Rename Worktree</h3>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </div>
        <div className="dialog-body">
          <div className="form-group">
            <label htmlFor="old-path">Current Path:</label>
            <input id="old-path" type="text" value={worktreePath} disabled className="form-input" />
          </div>
          <div className="form-group">
            <label htmlFor="new-path">New Path:</label>
            <input
              id="new-path"
              type="text"
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              onKeyDown={handleKeyDown}
              className="form-input"
              autoFocus
            />
            {error && <div className="form-error">{error}</div>}
          </div>
        </div>
        <div className="dialog-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleRename} disabled={loading}>
            {loading ? "Renaming..." : "Rename"}
          </button>
        </div>
      </div>
    </div>
  );
}
