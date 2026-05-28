import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { WorktreeInfo } from "../../../shared/types";
import { gitClient } from "../services/gitClient";

export interface UseDeleteWorktree {
  isOpen: boolean;
  worktree: WorktreeInfo | null;
  loading: boolean;
  error: string | null;
  open: (worktree: WorktreeInfo) => void;
  close: () => void;
  delete: () => Promise<void>;
}

export function useDeleteWorktree(
  repoPath: string,
  onDeleted: () => void
): UseDeleteWorktree {
  const [isOpen, setIsOpen] = useState(false);
  const [worktree, setWorktree] = useState<WorktreeInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback((wt: WorktreeInfo) => {
    setWorktree(wt);
    setError(null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setWorktree(null);
    setError(null);
  }, []);

  const deleteWorktree = useCallback(async () => {
    if (!worktree) return;

    setLoading(true);
    setError(null);

    try {
      const result = await gitClient.deleteWorktree(repoPath, worktree.path);
      if (result.ok) {
        toast.success(`Worktree deleted: ${worktree.path}`);
        onDeleted();
        close();
      } else {
        const errorMessage = result.message || "Failed to delete worktree";
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete worktree";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [worktree, repoPath, onDeleted, close]);

  return {
    isOpen,
    worktree,
    loading,
    error,
    open,
    close,
    delete: deleteWorktree,
  };
}
