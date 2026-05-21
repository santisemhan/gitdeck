import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  GitBranch,
  GitCommit,
  GitStatus
} from "../../../shared/types";
import { describeError, gitClient } from "../services/gitClient";

export interface RepoSnapshot {
  status: GitStatus | null;
  history: GitCommit[];
  branches: GitBranch[];
}

export interface UseRepoData {
  data: RepoSnapshot;
  loading: boolean;
  refresh: () => Promise<void>;
  stageFile: (path: string) => Promise<void>;
  unstageFile: (path: string) => Promise<void>;
  stageAll: () => Promise<void>;
  unstageAll: () => Promise<void>;
  discardAll: () => Promise<void>;
  commit: (message: string) => Promise<boolean>;
  pull: () => Promise<void>;
  push: () => Promise<void>;
  checkoutBranch: (name: string) => Promise<void>;
  checkoutRemoteBranch: (remoteBranch: string) => Promise<void>;
  createBranch: (name: string) => Promise<void>;
}

export function useRepoData(repoPath: string | null): UseRepoData {
  const [data, setData] = useState<RepoSnapshot>({ status: null, history: [], branches: [] });
  const [loading, setLoading] = useState(false);
  const inflight = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!repoPath) return;
    const token = ++inflight.current;
    setLoading(true);
    try {
      const [status, history, branches] = await Promise.all([
        gitClient.status(repoPath),
        gitClient.history(repoPath),
        gitClient.branches(repoPath)
      ]);
      if (token === inflight.current) {
        setData({ status, history, branches });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load repository";
      toast.error(message);
    } finally {
      if (token === inflight.current) setLoading(false);
    }
  }, [repoPath]);

  useEffect(() => {
    setData({ status: null, history: [], branches: [] });
    void load();
  }, [load]);

  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  useEffect(() => {
    if (!repoPath) return;

    const queueRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = null;
        void load();
      }, 220);
    };

    let unlisten: (() => void) | null = null;
    let cancelled = false;

    void (async () => {
      const watchResult = await gitClient.watchRepository(repoPath);
      if (!watchResult.ok) {
        toast.error(describeError(watchResult.message, "Could not enable live refresh"));
        return;
      }
      if (cancelled) {
        void gitClient.unwatchRepository();
        return;
      }
      unlisten = gitClient.onRepositoryChanged((event) => {
        if (event.repoPath === repoPath) queueRefresh();
      });
    })();

    return () => {
      cancelled = true;
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
      if (unlisten) unlisten();
      void gitClient.unwatchRepository();
    };
  }, [repoPath, load]);

  const run = useCallback(
    async (
      action: () => Promise<{ ok: boolean; message?: string }>,
      onSuccess?: string,
      fallback = "Operation failed"
    ): Promise<boolean> => {
      if (!repoPath) return false;
      try {
        const result = await action();
        if (!result.ok) {
          toast.error(describeError(result.message, fallback));
          return false;
        }
        if (onSuccess) toast.success(onSuccess);
        await load();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : fallback;
        toast.error(message);
        return false;
      }
    },
    [repoPath, load]
  );

  const stageFile = useCallback(
    async (path: string) => {
      await run(() => gitClient.stageFile(repoPath!, path), undefined, "Failed to stage file");
    },
    [run, repoPath]
  );

  const unstageFile = useCallback(
    async (path: string) => {
      await run(() => gitClient.unstageFile(repoPath!, path), undefined, "Failed to unstage file");
    },
    [run, repoPath]
  );

  const stageAll = useCallback(
    async () => {
      await run(() => gitClient.stageAll(repoPath!), "Staged all changes", "Failed to stage all");
    },
    [run, repoPath]
  );

  const unstageAll = useCallback(
    async () => {
      await run(() => gitClient.unstageAll(repoPath!), "Unstaged all changes", "Failed to unstage all");
    },
    [run, repoPath]
  );

  const discardAll = useCallback(
    async () => {
      await run(() => gitClient.discardAll(repoPath!), "Discarded all local changes", "Failed to discard all changes");
    },
    [run, repoPath]
  );

  const commit = useCallback(
    async (message: string) => run(() => gitClient.commit(repoPath!, message), "Commit created", "Commit failed"),
    [run, repoPath]
  );

  const pull = useCallback(
    async () => {
      await run(() => gitClient.pull(repoPath!), "Pulled from remote", "Pull failed");
    },
    [run, repoPath]
  );

  const push = useCallback(
    async () => {
      await run(() => gitClient.push(repoPath!), "Pushed to remote", "Push failed");
    },
    [run, repoPath]
  );

  const checkoutBranch = useCallback(
    async (name: string) => {
      await run(() => gitClient.checkoutBranch(repoPath!, name), `Checked out ${name}`, "Checkout failed");
    },
    [run, repoPath]
  );

  const checkoutRemoteBranch = useCallback(
    async (remoteBranch: string) => {
      await run(
        () => gitClient.checkoutRemoteBranch(repoPath!, remoteBranch),
        `Checked out ${remoteBranch}`,
        "Checkout failed"
      );
    },
    [run, repoPath]
  );

  const createBranch = useCallback(
    async (name: string) => {
      await run(() => gitClient.createBranch(repoPath!, name), `Created branch ${name}`, "Create branch failed");
    },
    [run, repoPath]
  );

  return {
    data,
    loading,
    refresh: load,
    stageFile,
    unstageFile,
    stageAll,
    unstageAll,
    discardAll,
    commit,
    pull,
    push,
    checkoutBranch,
    checkoutRemoteBranch,
    createBranch
  };
}
