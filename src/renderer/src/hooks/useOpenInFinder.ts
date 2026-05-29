import { useCallback } from "react";
import { toast } from "sonner";
import { gitClient } from "../services/gitClient";

export function useOpenInFinder() {
  const openInFinder = useCallback(async (path: string) => {
    try {
      const result = await gitClient.openInFinder(path);
      if (!result.ok) {
        const errorMessage = result.message || "Failed to open in Finder";
        toast.error(errorMessage);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to open in Finder";
      toast.error(errorMessage);
    }
  }, []);

  return { openInFinder };
}
