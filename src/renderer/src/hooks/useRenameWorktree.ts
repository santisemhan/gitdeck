import { useCallback, useState } from "react";
import type { WorktreeInfo } from "../../../shared/types";

export interface UseRenameWorktree {
  isOpen: boolean;
  worktree?: WorktreeInfo;
  open: (worktree: WorktreeInfo) => void;
  close: () => void;
}

export function useRenameWorktree(): UseRenameWorktree {
  const [isOpen, setIsOpen] = useState(false);
  const [worktree, setWorktree] = useState<WorktreeInfo | undefined>(undefined);

  const open = useCallback((wt: WorktreeInfo) => {
    setWorktree(wt);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setWorktree(undefined);
  }, []);

  return { isOpen, worktree, open, close };
}
