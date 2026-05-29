import { useState, useEffect, useRef } from "react";
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
  const [worktreeName, setWorktreeName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createBranch, setCreateBranch] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setWorktreeName(branchName || "");
      setError(null);
      setCreateBranch(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [isOpen, branchName]);

  const getTargetPath = () => {
    const name = worktreeName.trim();
    if (!name) return "";
    const normalizedRepo = repoPath.replace(/[\\/]+$/, "");
    return `${normalizedRepo}/.worktrees/${name}`;
  };

  const validateName = (name: string): string | null => {
    if (!name.trim()) {
      return "Worktree name is required";
    }

    if (!/^[a-zA-Z0-9_\-.]+$/.test(name.trim())) {
      return "Name can only contain letters, numbers, hyphens, underscores, and dots";
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
    const validationError = validateName(worktreeName);
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    const targetPath = getTargetPath();

    const pathExists = await checkPathExists(targetPath);
    if (pathExists) {
      const errorMsg = "Worktree with this name already exists";
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await gitClient.createWorktree(repoPath, branchName, targetPath);
      if (result.ok) {
        toast.success(`Worktree created at .worktrees/${worktreeName.trim()}`);
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
    setWorktreeName("");
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
        value={worktreeName}
        onChange={(e) => setWorktreeName(e.target.value)}
        placeholder="worktree-name"
      />
      {worktreeName.trim() && (
        <span className="create-branch-banner-text" style={{ color: "var(--text-3)" }}>
          → .worktrees/{worktreeName.trim()}
        </span>
      )}
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
