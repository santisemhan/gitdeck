import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePruneWorktree } from "../../src/renderer/src/hooks/usePruneWorktree";
import { gitClient } from "../../src/renderer/src/services/gitClient";

vi.mock("../../src/renderer/src/services/gitClient", () => ({
  gitClient: {
    pruneWorktree: vi.fn(),
  },
}));

describe("usePruneWorktree", () => {
  afterEach(() => vi.restoreAllMocks());

  it("prunes worktree successfully", async () => {
    vi.mocked(gitClient.pruneWorktree).mockResolvedValue({ ok: true, code: 0, stdout: "", stderr: "" });
    const onPruned = vi.fn();
    const { result } = renderHook(() => usePruneWorktree("/Users/test/repos/my-app", onPruned));

    await act(async () => {
      await result.current.prune("/Users/test/repos/my-app-feature");
    });

    expect(gitClient.pruneWorktree).toHaveBeenCalledWith("/Users/test/repos/my-app", "/Users/test/repos/my-app-feature");
    expect(onPruned).toHaveBeenCalled();
  });

  it("handles error when prune fails", async () => {
    vi.mocked(gitClient.pruneWorktree).mockResolvedValue({ ok: false, code: 1, stdout: "", stderr: "Failed to prune", message: "Failed to prune" });
    const onPruned = vi.fn();
    const { result } = renderHook(() => usePruneWorktree("/Users/test/repos/my-app", onPruned));

    await act(async () => {
      await result.current.prune("/Users/test/repos/my-app-feature");
    });

    expect(result.current.error).toBe("Failed to prune");
    expect(onPruned).not.toHaveBeenCalled();
  });

  it("handles exception", async () => {
    vi.mocked(gitClient.pruneWorktree).mockRejectedValue(new Error("Network error"));
    const onPruned = vi.fn();
    const { result } = renderHook(() => usePruneWorktree("/Users/test/repos/my-app", onPruned));

    await act(async () => {
      await result.current.prune("/Users/test/repos/my-app-feature");
    });

    expect(result.current.error).toBe("Network error");
    expect(onPruned).not.toHaveBeenCalled();
  });

  it("sets loading state during prune", async () => {
    let resolvePrune: (value: { ok: boolean; code: number; stdout: string; stderr: string }) => void;
    vi.mocked(gitClient.pruneWorktree).mockReturnValue(new Promise((resolve) => { resolvePrune = resolve; }));
    const { result } = renderHook(() => usePruneWorktree("/Users/test/repos/my-app", vi.fn()));

    let prunePromise: Promise<void>;
    act(() => {
      prunePromise = result.current.prune("/Users/test/repos/my-app-feature");
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolvePrune!({ ok: true, code: 0, stdout: "", stderr: "" });
      await prunePromise;
    });

    expect(result.current.loading).toBe(false);
  });
});
