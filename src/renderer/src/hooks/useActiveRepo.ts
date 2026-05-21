import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Repository } from "../../../shared/types";
import { gitClient } from "../services/gitClient";

const LAST_REPO_KEY = "gitdeck:lastRepo";

export interface ActiveRepo {
  path: string;
  name: string;
}

export interface UseActiveRepo {
  repos: ActiveRepo[];
  repo: ActiveRepo | null;
  activePath: string | null;
  recents: Repository[];
  ready: boolean;
  openPicker: () => Promise<void>;
  openByPath: (repo: Repository) => Promise<void>;
  setActiveByPath: (path: string) => void;
  closeByPath: (path: string) => void;
  refreshRecents: () => Promise<void>;
  close: () => void;
}

export function useActiveRepo(): UseActiveRepo {
  const [repos, setRepos] = useState<ActiveRepo[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [recents, setRecents] = useState<Repository[]>([]);
  const [ready, setReady] = useState(false);

  const refreshRecents = useCallback(async () => {
    const list = await gitClient.recentRepositories();
    setRecents(list);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await gitClient.recentRepositories();
      if (cancelled) return;
      setRecents(list);
      const last = localStorage.getItem(LAST_REPO_KEY);
      if (last) {
        const match = list.find((r) => r.path === last);
        if (match) {
          try {
            await gitClient.status(match.path);
            if (!cancelled) {
              setRepos([{ path: match.path, name: match.name }]);
              setActivePath(match.path);
            }
          } catch {
            localStorage.removeItem(LAST_REPO_KEY);
          }
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const adopt = useCallback((path: string, name: string) => {
    setRepos((current) => {
      if (current.some((repo) => repo.path === path)) {
        return current;
      }
      return [...current, { path, name }];
    });
    setActivePath(path);
    localStorage.setItem(LAST_REPO_KEY, path);
  }, []);

  const openPicker = useCallback(async () => {
    const result = await gitClient.selectRepository();
    if (!result?.ok) {
      if (result?.message) toast.error(result.message);
      return;
    }
    adopt(result.path!, result.name!);
    await refreshRecents();
  }, [adopt, refreshRecents]);

  const openByPath = useCallback(
    async (target: Repository) => {
      try {
        await gitClient.status(target.path);
        adopt(target.path, target.name);
        await refreshRecents();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not open repository";
        toast.error(message);
      }
    },
    [adopt, refreshRecents]
  );

  const close = useCallback(() => {
    setActivePath(null);
    localStorage.removeItem(LAST_REPO_KEY);
  }, []);

  const setActiveByPath = useCallback((path: string) => {
    if (!repos.some((repo) => repo.path === path)) {
      return;
    }
    setActivePath(path);
    localStorage.setItem(LAST_REPO_KEY, path);
  }, [repos]);

  const closeByPath = useCallback((path: string) => {
    setRepos((current) => {
      const index = current.findIndex((repo) => repo.path === path);
      if (index < 0) return current;
      const next = current.filter((repo) => repo.path !== path);
      if (next.length === 0) {
        setActivePath(null);
        localStorage.removeItem(LAST_REPO_KEY);
      } else {
        setActivePath((currentActivePath) => {
          if (currentActivePath !== path) {
            return currentActivePath;
          }
          const fallback = next[Math.min(index, next.length - 1)]!;
          localStorage.setItem(LAST_REPO_KEY, fallback.path);
          return fallback.path;
        });
      }
      return next;
    });
  }, []);

  const repo = repos.find((item) => item.path === activePath) ?? null;

  return {
    repos,
    repo,
    activePath,
    recents,
    ready,
    openPicker,
    openByPath,
    setActiveByPath,
    closeByPath,
    refreshRecents,
    close
  };
}
