import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { gitClient } from "../services/gitClient";

interface CreateWorktreeDialogProps {
  isOpen: boolean;
  branchName: string;
  isRemote: boolean;
  repoPath: string;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateWorktreeDialog({
  isOpen,
  branchName,
  isRemote,
  repoPath,
  onClose,
  onCreated,
}: CreateWorktreeDialogProps) {
  const [targetPath, setTargetPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createBranch, setCreateBranch] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const getDefaultPath = useCallback((repo: string, branch: string): string => {
    const normalizedRepo = repo.replace(/[\\/]+$/, "");
    const lastSeparator = Math.max(
      normalizedRepo.lastIndexOf("/"),
      normalizedRepo.lastIndexOf("\\")
    );
    if (lastSeparator === -1) {
      return branch;
    }
    const parentDir = normalizedRepo.substring(0, lastSeparator);
    return `${parentDir}/${branch}`;
  }, []);

  useEffect(() => {
    if (isOpen && repoPath) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      const defaultPath = getDefaultPath(repoPath, branchName);
      setTargetPath(defaultPath);
      setError(null);
      setCreateBranch(false);
      setTimeout(() => {
        dialogRef.current?.focus();
      }, 0);
    }
    return () => {
      previousFocusRef.current?.focus();
    };
  }, [isOpen, repoPath, branchName, getDefaultPath]);

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

  const validatePath = (path: string): string | null => {
    if (!path.trim()) {
      return "Target path is required";
    }

    const normalizedPath = path.replace(/[\\/]+$/, "").toLowerCase();
    const normalizedRepo = repoPath.replace(/[\\/]+$/, "").toLowerCase();

    if (normalizedPath === normalizedRepo) {
      return "Cannot create worktree at repository root";
    }

    if (normalizedPath.startsWith(normalizedRepo + "/") || normalizedPath.startsWith(normalizedRepo + "\\")) {
      return "Cannot create worktree inside repository directory";
    }

    if (path.includes("..") || path.includes("~")) {
      return "Path contains invalid characters";
    }

    return null;
  };

  const checkPathExists = async (path: string): Promise<boolean> => {
    try {
      const result = await gitClient.listWorktrees(repoPath);
      return result.some((w) => {
        const normalizedWorktreePath = w.path.replace(/[\\/]+$/, "").toLowerCase();
        const normalizedTarget = path.replace(/[\\/]+$/, "").toLowerCase();
        return normalizedWorktreePath === normalizedTarget;
      });
    } catch {
      return false;
    }
  };

  const handleCreate = async () => {
    const validationError = validatePath(targetPath);
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    const pathExists = await checkPathExists(targetPath);
    if (pathExists) {
      const errorMsg = "Target path already exists";
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await gitClient.createWorktree(repoPath, branchName, targetPath);
      if (result.ok) {
        toast.success(`Worktree created at ${targetPath}`);
        onCreated();
        onClose();
      } else {
        const errorMessage = result.message || "Failed to create worktree";
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create worktree";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) {
      handleCreate();
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
        aria-labelledby="dialog-title"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="dialog-header">
          <h3 id="dialog-title">Create Worktree</h3>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </div>
        <div className="dialog-body">
          <div className="form-group">
            <label htmlFor="branch-name">Branch:</label>
            <input
              id="branch-name"
              type="text"
              value={branchName}
              disabled
              className="form-input"
            />
          </div>
          {isRemote && (
            <div className="form-group">
              <label htmlFor="create-branch">
                <input
                  id="create-branch"
                  type="checkbox"
                  checked={createBranch}
                  onChange={(e) => setCreateBranch(e.target.checked)}
                />
                Create local tracking branch
              </label>
            </div>
          )}
          <div className="form-group">
            <label htmlFor="target-path">Target Path:</label>
            <input
              id="target-path"
              type="text"
              value={targetPath}
              onChange={(e) => setTargetPath(e.target.value)}
              onKeyDown={handleKeyDown}
              className="form-input"
              placeholder="/path/to/worktree"
              autoFocus
            />
            {error && <div className="form-error">{error}</div>}
          </div>
        </div>
        <div className="dialog-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={loading}>
            {loading ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
