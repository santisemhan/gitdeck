import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Repository } from "../../../shared/types";
import { gitClient } from "../services/gitClient";
import { STORAGE_KEYS } from "../constants/storageKeys";

function readStoredOpenRepos(): ActiveRepo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.openRepos);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is ActiveRepo =>
          !!item &&
          typeof item === "object" &&
          typeof (item as { path?: unknown }).path === "string" &&
          typeof (item as { name?: unknown }).name === "string"
      )
      .map((repo) => ({ path: repo.path, name: repo.name }));
  } catch {
    return [];
  }
}

function writeStoredOpenRepos(repos: ActiveRepo[]): void {
  try {
    if (repos.length === 0) {
      localStorage.removeItem(STORAGE_KEYS.openRepos);
      return;
    }
    localStorage.setItem(STORAGE_KEYS.openRepos, JSON.stringify(repos));
  } catch {
  }
}

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
  chooseDirectory: () => Promise<string | null>;
  cloneRepo: (url: string, parentDir: string) => Promise<boolean>;
  initRepo: (targetPath: string) => Promise<boolean>;
  setActiveByPath: (path: string) => void;
  closeByPath: (path: string) => void;
  closeHome: () => void;
  reorderByPath: (sourcePath: string, targetPath: string, placeAfter?: boolean) => void;
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
      const openRepos = readStoredOpenRepos();
      if (openRepos.length > 0) {
        const validRepos: ActiveRepo[] = [];
        for (const stored of openRepos) {
          try {
            await gitClient.status(stored.path);
            validRepos.push(stored);
          } catch {
            // ignore repos that can no longer be opened
          }
        }

        if (!cancelled) {
          setRepos(validRepos);
          const last = localStorage.getItem(STORAGE_KEYS.lastRepoPath);
          if (last && validRepos.some((repo) => repo.path === last)) {
            setActivePath(last);
          } else if (validRepos[0]) {
            setActivePath(validRepos[0].path);
            localStorage.setItem(STORAGE_KEYS.lastRepoPath, validRepos[0].path);
          } else {
            localStorage.removeItem(STORAGE_KEYS.lastRepoPath);
          }
        }
      } else {
        const last = localStorage.getItem(STORAGE_KEYS.lastRepoPath);
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
              localStorage.removeItem(STORAGE_KEYS.lastRepoPath);
            }
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
    localStorage.setItem(STORAGE_KEYS.lastRepoPath, path);
  }, []);

  useEffect(() => {
    writeStoredOpenRepos(repos);
  }, [repos]);

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

  const chooseDirectory = useCallback(async () => {
    const result = await gitClient.selectDirectory();
    if (!result?.ok || !result.path) {
      if (result?.message && result.message !== "No folder selected") toast.error(result.message);
      return null;
    }
    return result.path;
  }, []);

  const cloneRepo = useCallback(
    async (url: string, parentDir: string) => {
      const result = await gitClient.cloneRepository(url, parentDir);
      if (!result.ok || !result.path || !result.name) {
        toast.error(result.message || "Could not clone repository");
        return false;
      }
      adopt(result.path, result.name);
      await refreshRecents();
      toast.success(`Cloned ${result.name}`);
      return true;
    },
    [adopt, refreshRecents]
  );

  const initRepo = useCallback(
    async (targetPath: string) => {
      const result = await gitClient.initRepository(targetPath);
      if (!result.ok || !result.path || !result.name) {
        toast.error(result.message || "Could not create repository");
        return false;
      }
      adopt(result.path, result.name);
      await refreshRecents();
      toast.success(`Created ${result.name}`);
      return true;
    },
    [adopt, refreshRecents]
  );

  // Go back to the launcher/home WITHOUT discarding open tabs. The repos array
  // (and its localStorage mirror) is preserved so the user can return to any tab.
  const close = useCallback(() => {
    setActivePath(null);
    localStorage.removeItem(STORAGE_KEYS.lastRepoPath);
  }, []);

  const setActiveByPath = useCallback((path: string) => {
    if (!repos.some((repo) => repo.path === path)) {
      return;
    }
    setActivePath(path);
    localStorage.setItem(STORAGE_KEYS.lastRepoPath, path);
  }, [repos]);

  const closeByPath = useCallback((path: string) => {
    setRepos((current) => {
      const index = current.findIndex((repo) => repo.path === path);
      if (index < 0) return current;
      const next = current.filter((repo) => repo.path !== path);
        if (next.length === 0) {
          setActivePath(null);
          localStorage.removeItem(STORAGE_KEYS.lastRepoPath);
        } else {
          setActivePath((currentActivePath) => {
            if (currentActivePath !== path) {
              return currentActivePath;
            }
            const fallback = next[Math.min(index, next.length - 1)]!;
            localStorage.setItem(STORAGE_KEYS.lastRepoPath, fallback.path);
            return fallback.path;
          });
        }
      return next;
    });
  }, []);

  // Close the "New tab" (Home) screen: jump to the most recent open repo if any
  // exist. If Home is the only tab there is nowhere to go, so it's a no-op.
  const closeHome = useCallback(() => {
    setRepos((current) => {
      if (current.length === 0) return current;
      const last = localStorage.getItem(STORAGE_KEYS.lastRepoPath);
      const target = current.find((repo) => repo.path === last) ?? current[current.length - 1]!;
      setActivePath(target.path);
      localStorage.setItem(STORAGE_KEYS.lastRepoPath, target.path);
      return current;
    });
  }, []);

  const reorderByPath = useCallback((sourcePath: string, targetPath: string, placeAfter = false) => {
    if (sourcePath === targetPath) {
      return;
    }

    setRepos((current) => {
      const sourceIndex = current.findIndex((repo) => repo.path === sourcePath);
      if (sourceIndex < 0 || current.findIndex((repo) => repo.path === targetPath) < 0) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      if (!moved) {
        return current;
      }
      // Recompute the target index AFTER removing the source so insertion is
      // correct regardless of drag direction.
      let insertIndex = next.findIndex((repo) => repo.path === targetPath);
      if (placeAfter) insertIndex += 1;
      next.splice(insertIndex, 0, moved);
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
    chooseDirectory,
    cloneRepo,
    initRepo,
    setActiveByPath,
    closeByPath,
    closeHome,
    reorderByPath,
    refreshRecents,
    close
  };
}
