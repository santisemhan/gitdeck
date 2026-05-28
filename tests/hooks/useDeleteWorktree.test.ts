import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDeleteWorktree } from "../../src/renderer/src/hooks/useDeleteWorktree";
import { gitClient } from "../../src/renderer/src/services/gitClient";
import type { WorktreeInfo } from "../../src/shared/types";

vi.mock("../../src/renderer/src/services/gitClient", () => ({
  gitClient: {
    deleteWorktree: vi.fn(),
  },
}));

const mockWorktree: WorktreeInfo = {
  path: "/Users/test/repos/my-app-feature",
  branch: "feature-branch",
  isMain: false,
  isOrphaned: false,
  hasChanges: false,
};

describe("useDeleteWorktree", () => {
  afterEach(() => vi.restoreAllMocks());

  it("starts with dialog closed", () => {
    const { result } = renderHook(() => useDeleteWorktree("/Users/test/repos/my-app", vi.fn()));
    expect(result.current.isOpen).toBe(false);
    expect(result.current.worktree).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("opens dialog with worktree info", () => {
    const { result } = renderHook(() => useDeleteWorktree("/Users/test/repos/my-app", vi.fn()));
    act(() => result.current.open(mockWorktree));
    expect(result.current.isOpen).toBe(true);
    expect(result.current.worktree).toBe(mockWorktree);
  });

  it("closes dialog and resets state", () => {
    const { result } = renderHook(() => useDeleteWorktree("/Users/test/repos/my-app", vi.fn()));
    act(() => result.current.open(mockWorktree));
    expect(result.current.isOpen).toBe(true);
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.worktree).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("deletes worktree successfully", async () => {
    vi.mocked(gitClient.deleteWorktree).mockResolvedValue({ ok: true, code: 0, stdout: "", stderr: "" });
    const onDeleted = vi.fn();
    const { result } = renderHook(() => useDeleteWorktree("/Users/test/repos/my-app", onDeleted));
    
    act(() => result.current.open(mockWorktree));
    await act(async () => {
      await result.current.delete();
    });
    
    expect(gitClient.deleteWorktree).toHaveBeenCalledWith("/Users/test/repos/my-app", mockWorktree.path);
    expect(onDeleted).toHaveBeenCalled();
    expect(result.current.isOpen).toBe(false);
  });

  it("handles deletion error", async () => {
    vi.mocked(gitClient.deleteWorktree).mockResolvedValue({ ok: false, code: 1, stdout: "", stderr: "Failed to delete", message: "Failed to delete" });
    const onDeleted = vi.fn();
    const { result } = renderHook(() => useDeleteWorktree("/Users/test/repos/my-app", onDeleted));
    
    act(() => result.current.open(mockWorktree));
    await act(async () => {
      await result.current.delete();
    });
    
    expect(result.current.error).toBe("Failed to delete");
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("handles deletion exception", async () => {
    vi.mocked(gitClient.deleteWorktree).mockRejectedValue(new Error("Network error"));
    const onDeleted = vi.fn();
    const { result } = renderHook(() => useDeleteWorktree("/Users/test/repos/my-app", onDeleted));
    
    act(() => result.current.open(mockWorktree));
    await act(async () => {
      await result.current.delete();
    });
    
    expect(result.current.error).toBe("Network error");
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("sets loading state during deletion", async () => {
    let resolveDelete: (value: { ok: boolean; code: number; stdout: string; stderr: string }) => void;
    vi.mocked(gitClient.deleteWorktree).mockReturnValue(new Promise((resolve) => { resolveDelete = resolve; }));
    const { result } = renderHook(() => useDeleteWorktree("/Users/test/repos/my-app", vi.fn()));
    
    act(() => result.current.open(mockWorktree));
    
    let deletePromise: Promise<void>;
    act(() => {
      deletePromise = result.current.delete();
    });
    
    expect(result.current.loading).toBe(true);
    
    await act(async () => {
      resolveDelete!({ ok: true, code: 0, stdout: "", stderr: "" });
      await deletePromise;
    });
    
    expect(result.current.loading).toBe(false);
  });

  it("does not delete when worktree is null", async () => {
    vi.mocked(gitClient.deleteWorktree).mockClear();
    const onDeleted = vi.fn();
    const { result } = renderHook(() => useDeleteWorktree("/Users/test/repos/my-app", onDeleted));
    
    await act(async () => {
      await result.current.delete();
    });
    
    expect(gitClient.deleteWorktree).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
