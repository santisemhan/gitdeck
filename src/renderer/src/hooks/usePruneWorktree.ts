import { useCallback, useState } from "react";
import { toast } from "sonner";
import { gitClient } from "../services/gitClient";

export function usePruneWorktree(repoPath: string, onPruned: () => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prune = useCallback(async (worktreePath: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await gitClient.pruneWorktree(repoPath, worktreePath);
      if (result.ok) {
        toast.success("Worktree pruned successfully");
        onPruned();
      } else {
        const errorMessage = result.message || "Failed to prune worktree";
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to prune worktree";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [repoPath, onPruned]);

  return { prune, loading, error };
}
