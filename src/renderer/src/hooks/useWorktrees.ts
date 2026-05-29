import { useCallback, useEffect, useRef, useState } from "react";
import type { WorktreeInfo } from "../../../shared/types";
import { gitClient } from "../services/gitClient";

export interface UseWorktrees {
  worktrees: WorktreeInfo[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useWorktrees(repoPath: string | null): UseWorktrees {
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!repoPath) {
      setWorktrees([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await gitClient.listWorktrees(repoPath);
      setWorktrees(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load worktrees";
      setError(message);
      setWorktrees([]);
    } finally {
      setLoading(false);
    }
  }, [repoPath]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!repoPath) return;

    const queueRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = null;
        void refresh();
      }, 220);
    };

    const unlisten = gitClient.onRepositoryChanged((event) => {
      if (event.repoPath === repoPath) queueRefresh();
    });

    return () => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
      unlisten();
    };
  }, [repoPath, refresh]);

  return {
    worktrees,
    loading,
    error,
    refresh,
  };
}
