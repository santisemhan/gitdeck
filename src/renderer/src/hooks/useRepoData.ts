import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  GitBranch,
  GitCommit,
  GitStashEntry,
  GitStatus
} from "../../../shared/types";
import { describeError, gitClient } from "../services/gitClient";

export interface RepoSnapshot {
  status: GitStatus | null;
  history: GitCommit[];
  branches: GitBranch[];
  stashes: GitStashEntry[];
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
  createBranch: (name: string, startPoint?: string) => Promise<void>;
  deleteBranch: (name: string) => Promise<void>;
  renameBranch: (oldName: string, newName: string) => Promise<void>;
  stashPush: (message: string) => Promise<boolean>;
  stashPop: (index: number) => Promise<void>;
  stashApply: (index: number) => Promise<void>;
  stashDrop: (index: number) => Promise<void>;
  cherryPick: (hash: string) => Promise<void>;
  revertCommit: (hash: string) => Promise<void>;
}

export function useRepoData(repoPath: string | null): UseRepoData {
  const [data, setData] = useState<RepoSnapshot>({ status: null, history: [], branches: [], stashes: [] });
  const [loading, setLoading] = useState(false);
  const inflight = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!repoPath) return;
    const token = ++inflight.current;
    setLoading(true);
    try {
      const [status, history, branches, stashes] = await Promise.all([
        gitClient.status(repoPath),
        gitClient.history(repoPath),
        gitClient.branches(repoPath),
        gitClient.stashList(repoPath)
      ]);
      if (token === inflight.current) {
        setData({ status, history, branches, stashes });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load repository";
      toast.error(message);
    } finally {
      if (token === inflight.current) setLoading(false);
    }
  }, [repoPath]);

  useEffect(() => {
    setData({ status: null, history: [], branches: [], stashes: [] });
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
    async (name: string, startPoint?: string) => {
      await run(() => gitClient.createBranch(repoPath!, name, startPoint), `Created branch ${name}`, "Create branch failed");
    },
    [run, repoPath]
  );

  const deleteBranch = useCallback(
    async (name: string) => {
      await run(() => gitClient.deleteBranch(repoPath!, name), `Deleted branch ${name}`, "Delete branch failed");
    },
    [run, repoPath]
  );

  const renameBranch = useCallback(
    async (oldName: string, newName: string) => {
      await run(() => gitClient.renameBranch(repoPath!, oldName, newName), `Renamed branch to ${newName}`, "Rename branch failed");
    },
    [run, repoPath]
  );

  const stashPush = useCallback(
    async (message: string) => run(() => gitClient.stashPush(repoPath!, message), "Stash created", "Stash failed"),
    [run, repoPath]
  );

  const stashPop = useCallback(
    async (index: number) => {
      await run(() => gitClient.stashPop(repoPath!, index), "Stash popped", "Stash pop failed");
    },
    [run, repoPath]
  );

  const stashApply = useCallback(
    async (index: number) => {
      await run(() => gitClient.stashApply(repoPath!, index), "Stash applied", "Stash apply failed");
    },
    [run, repoPath]
  );

  const stashDrop = useCallback(
    async (index: number) => {
      await run(() => gitClient.stashDrop(repoPath!, index), "Stash dropped", "Stash drop failed");
    },
    [run, repoPath]
  );

  const cherryPick = useCallback(
    async (hash: string) => {
      await run(() => gitClient.cherryPick(repoPath!, hash), "Cherry pick applied", "Cherry pick failed");
    },
    [run, repoPath]
  );

  const revertCommit = useCallback(
    async (hash: string) => {
      await run(() => gitClient.revertCommit(repoPath!, hash), "Commit reverted", "Revert failed");
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
    createBranch,
    deleteBranch,
    renameBranch,
    stashPush,
    stashPop,
    stashApply,
    stashDrop,
    cherryPick,
    revertCommit
  };
}
