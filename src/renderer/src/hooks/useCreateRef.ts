import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { CreateRefKind } from "../data/types";

interface CreateRefActions {
  createBranch: (name: string, startPoint?: string) => Promise<void>;
  createTag: (name: string, startPoint?: string) => Promise<void>;
  onTagCreated?: (name: string) => void;
}

export function useCreateRef(actions: CreateRefActions) {
  const [nameInput, setNameInput] = useState("");
  const [startPoint, setStartPoint] = useState<string | null>(null);
  const [kind, setKind] = useState<CreateRefKind>("branch");
  const [showBanner, setShowBanner] = useState(false);

  const close = useCallback(() => {
    setShowBanner(false);
    setNameInput("");
    setStartPoint(null);
  }, []);

  const openCreateBranch = useCallback(() => {
    setKind("branch");
    setStartPoint(null);
    setNameInput("");
    setShowBanner(true);
  }, []);

  const openCreateBranchFrom = useCallback((fromRef: string) => {
    setKind("branch");
    setStartPoint(fromRef);
    setNameInput("");
    setShowBanner(true);
  }, []);

  const openCreateTagFrom = useCallback((fromRef: string) => {
    setKind("tag");
    setStartPoint(fromRef);
    setNameInput("");
    setShowBanner(true);
  }, []);

  const submit = useCallback(async () => {
    const name = nameInput.trim();
    if (!name) {
      toast.error(kind === "tag" ? "Tag name is required" : "Branch name is required");
      return;
    }

    if (kind === "tag") {
      await actions.createTag(name, startPoint ?? undefined);
      actions.onTagCreated?.(name);
      close();
      return;
    }

    await actions.createBranch(name, startPoint ?? undefined);
    close();
  }, [actions, close, kind, nameInput, startPoint]);

  return {
    nameInput,
    setNameInput,
    startPoint,
    kind,
    showBanner,
    setShowBanner,
    close,
    openCreateBranch,
    openCreateBranchFrom,
    openCreateTagFrom,
    submit,
  };
}
