import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCreateWorktree } from "../../src/renderer/src/hooks/useCreateWorktree";

describe("useCreateWorktree", () => {
  afterEach(() => vi.restoreAllMocks());

  it("starts with dialog closed", () => {
    const { result } = renderHook(() => useCreateWorktree());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.branchName).toBe("");
    expect(result.current.isRemote).toBe(false);
  });

  it("opens dialog with branch info", () => {
    const { result } = renderHook(() => useCreateWorktree());
    act(() => result.current.open("feature-branch", false));
    expect(result.current.isOpen).toBe(true);
    expect(result.current.branchName).toBe("feature-branch");
    expect(result.current.isRemote).toBe(false);
  });

  it("opens dialog for remote branch", () => {
    const { result } = renderHook(() => useCreateWorktree());
    act(() => result.current.open("origin/feature-branch", true));
    expect(result.current.isOpen).toBe(true);
    expect(result.current.branchName).toBe("origin/feature-branch");
    expect(result.current.isRemote).toBe(true);
  });

  it("closes dialog and resets state", () => {
    const { result } = renderHook(() => useCreateWorktree());
    act(() => result.current.open("feature-branch", false));
    expect(result.current.isOpen).toBe(true);
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.branchName).toBe("");
    expect(result.current.isRemote).toBe(false);
  });
});
