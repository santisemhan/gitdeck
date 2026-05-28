import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWorktrees } from "../../src/renderer/src/hooks/useWorktrees";
import { gitClient } from "../../src/renderer/src/services/gitClient";
import type { WorktreeInfo } from "../../src/shared/types";

vi.mock("../../src/renderer/src/services/gitClient", () => ({
  gitClient: {
    listWorktrees: vi.fn(),
  },
}));

const mockWorktrees: WorktreeInfo[] = [
  {
    path: "/Users/test/repos/my-app",
    branch: "main",
    isMain: true,
    isOrphaned: false,
    hasChanges: false,
  },
  {
    path: "/Users/test/repos/my-app-feature",
    branch: "feature-branch",
    isMain: false,
    isOrphaned: false,
    hasChanges: true,
  },
];

describe("useWorktrees", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty worktrees when repoPath is null", () => {
    const { result } = renderHook(() => useWorktrees(null));
    expect(result.current.worktrees).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("loads worktrees on mount", async () => {
    vi.mocked(gitClient.listWorktrees).mockResolvedValue(mockWorktrees);
    const { result } = renderHook(() => useWorktrees("/Users/test/repos/my-app"));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.worktrees).toEqual(mockWorktrees);
    expect(result.current.error).toBeNull();
    expect(gitClient.listWorktrees).toHaveBeenCalledWith("/Users/test/repos/my-app");
  });

  it("handles error when loading worktrees", async () => {
    vi.mocked(gitClient.listWorktrees).mockRejectedValue(new Error("Failed to load"));
    const { result } = renderHook(() => useWorktrees("/Users/test/repos/my-app"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.worktrees).toEqual([]);
    expect(result.current.error).toBe("Failed to load");
  });

  it("refreshes worktrees when refresh is called", async () => {
    vi.mocked(gitClient.listWorktrees).mockResolvedValue(mockWorktrees);
    const { result } = renderHook(() => useWorktrees("/Users/test/repos/my-app"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.worktrees).toEqual(mockWorktrees);

    const newWorktrees = [...mockWorktrees, { path: "/Users/test/repos/new-worktree", branch: "new-branch", isMain: false, isOrphaned: false, hasChanges: false }];
    vi.mocked(gitClient.listWorktrees).mockResolvedValue(newWorktrees);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.worktrees).toEqual(newWorktrees);
  });

  it("clears worktrees when repoPath changes to null", async () => {
    vi.mocked(gitClient.listWorktrees).mockResolvedValue(mockWorktrees);
    const { result, rerender } = renderHook(({ repoPath }) => useWorktrees(repoPath), {
      initialProps: { repoPath: "/Users/test/repos/my-app" },
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.worktrees).toEqual(mockWorktrees);

    rerender({ repoPath: null });

    await waitFor(() => {
      expect(result.current.worktrees).toEqual([]);
    });
  });
});
