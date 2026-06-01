import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { CreateRefKind } from "../data/types";

interface CreateRefActions {
  createBranch: (name: string, startPoint?: string) => Promise<void>;
  createTag: (name: string, startPoint?: string) => Promise<void>;
  pushTag: (name: string) => Promise<void>;
}

export function useCreateRef(actions: CreateRefActions) {
  const [nameInput, setNameInput] = useState("");
  const [startPoint, setStartPoint] = useState<string | null>(null);
  const [kind, setKind] = useState<CreateRefKind>("branch");
  const [lastCreatedTagName, setLastCreatedTagName] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  const close = useCallback(() => {
    setShowBanner(false);
    setNameInput("");
    setStartPoint(null);
    setLastCreatedTagName(null);
  }, []);

  const openCreateBranch = useCallback(() => {
    setKind("branch");
    setLastCreatedTagName(null);
    setStartPoint(null);
    setNameInput("");
    setShowBanner(true);
  }, []);

  const openCreateBranchFrom = useCallback((fromRef: string) => {
    setKind("branch");
    setLastCreatedTagName(null);
    setStartPoint(fromRef);
    setNameInput("");
    setShowBanner(true);
  }, []);

  const openCreateTagFrom = useCallback((fromRef: string) => {
    setKind("tag");
    setLastCreatedTagName(null);
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
      setLastCreatedTagName(name);
      return;
    }

    await actions.createBranch(name, startPoint ?? undefined);
    close();
  }, [actions, close, kind, nameInput, startPoint]);

  const pushCreatedTag = useCallback(async () => {
    const name = lastCreatedTagName?.trim();
    if (!name) return;
    await actions.pushTag(name);
    close();
  }, [actions, close, lastCreatedTagName]);

  return {
    nameInput,
    setNameInput,
    startPoint,
    kind,
    lastCreatedTagName,
    showBanner,
    setShowBanner,
    close,
    openCreateBranch,
    openCreateBranchFrom,
    openCreateTagFrom,
    submit,
    pushCreatedTag,
  };
}
