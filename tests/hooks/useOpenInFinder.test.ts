import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useOpenInFinder } from "../../src/renderer/src/hooks/useOpenInFinder";
import { gitClient } from "../../src/renderer/src/services/gitClient";

vi.mock("../../src/renderer/src/services/gitClient", () => ({
  gitClient: {
    openInFinder: vi.fn(),
  },
}));

describe("useOpenInFinder", () => {
  afterEach(() => vi.restoreAllMocks());

  it("opens Finder successfully", async () => {
    vi.mocked(gitClient.openInFinder).mockResolvedValue({ ok: true, code: 0, stdout: "", stderr: "" });
    const { result } = renderHook(() => useOpenInFinder());

    await act(async () => {
      await result.current.openInFinder("/Users/test/repos/my-app-feature");
    });

    expect(gitClient.openInFinder).toHaveBeenCalledWith("/Users/test/repos/my-app-feature");
  });

  it("handles error when open fails", async () => {
    vi.mocked(gitClient.openInFinder).mockResolvedValue({ ok: false, code: 1, stdout: "", stderr: "Path not found", message: "Path not found" });
    const { result } = renderHook(() => useOpenInFinder());

    await act(async () => {
      await result.current.openInFinder("/Users/test/repos/nonexistent");
    });

    expect(gitClient.openInFinder).toHaveBeenCalledWith("/Users/test/repos/nonexistent");
  });

  it("handles exception", async () => {
    vi.mocked(gitClient.openInFinder).mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useOpenInFinder());

    await act(async () => {
      await result.current.openInFinder("/Users/test/repos/my-app-feature");
    });

    expect(gitClient.openInFinder).toHaveBeenCalledWith("/Users/test/repos/my-app-feature");
  });
});
