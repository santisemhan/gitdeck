import { useCallback, useState } from "react";

export interface UseCreateWorktree {
  isOpen: boolean;
  branchName: string;
  isRemote: boolean;
  open: (branchName: string, isRemote: boolean) => void;
  close: () => void;
}

export function useCreateWorktree(): UseCreateWorktree {
  const [isOpen, setIsOpen] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [isRemote, setIsRemote] = useState(false);

  const open = useCallback((branch: string, remote: boolean) => {
    setBranchName(branch);
    setIsRemote(remote);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setBranchName("");
    setIsRemote(false);
  }, []);

  return {
    isOpen,
    branchName,
    isRemote,
    open,
    close,
  };
}
