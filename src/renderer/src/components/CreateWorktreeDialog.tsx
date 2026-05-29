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
  const inputRef = useRef<HTMLInputElement>(null);

  const getDefaultPath = useCallback((repo: string, branch: string): string => {
    const normalizedRepo = repo.replace(/[\\/]+$/, "");
    const branchName = branch || "my-feature";
    return `${normalizedRepo}/.worktrees/${branchName}`;
  }, []);

  useEffect(() => {
    if (isOpen && repoPath) {
      const defaultPath = getDefaultPath(repoPath, branchName);
      setTargetPath(defaultPath);
      setError(null);
      setCreateBranch(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [isOpen, repoPath, branchName, getDefaultPath]);

  const validatePath = (path: string): string | null => {
    if (!path.trim()) {
      return "Target path is required";
    }

    const normalizedPath = path.replace(/[\\/]+$/, "").toLowerCase();
    const normalizedRepo = repoPath.replace(/[\\/]+$/, "").toLowerCase();

    if (normalizedPath === normalizedRepo) {
      return "Cannot create worktree at repository root";
    }

    const isInsideWorktreesDir = normalizedPath.startsWith(normalizedRepo + "/.worktrees/") || normalizedPath.startsWith(normalizedRepo + "\\.worktrees\\");
    const isInsideRepo = normalizedPath.startsWith(normalizedRepo + "/") || normalizedPath.startsWith(normalizedRepo + "\\");

    if (isInsideRepo && !isInsideWorktreesDir) {
      return "Cannot create worktree inside repository directory (use .worktrees/ subdirectory)";
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleCreate();
  };

  const handleCancel = () => {
    setTargetPath("");
    setError(null);
    setCreateBranch(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <form
      className="create-branch-banner"
      role="dialog"
      onSubmit={handleSubmit}
    >
      <span className="create-branch-banner-text">
        Create worktree from {branchName}
      </span>
      {isRemote && (
        <label className="create-branch-banner-text" style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="checkbox"
            checked={createBranch}
            onChange={(e) => setCreateBranch(e.target.checked)}
          />
          Create branch
        </label>
      )}
      <input
        ref={inputRef}
        className="create-branch-input"
        value={targetPath}
        onChange={(e) => setTargetPath(e.target.value)}
        placeholder="/path/to/worktree"
      />
      {error && <span className="create-branch-banner-text" style={{ color: "#ff6b6b" }}>{error}</span>}
      <div className="create-branch-actions">
        <button className="create-branch-btn primary" type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create"}
        </button>
        <button
          className="create-branch-btn"
          type="button"
          onClick={handleCancel}
          disabled={loading}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
