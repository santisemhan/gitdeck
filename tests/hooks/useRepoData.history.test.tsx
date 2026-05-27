import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRepoData } from "../../src/renderer/src/hooks/useRepoData";
import { HISTORY_PAGE_SIZE } from "../../src/renderer/src/constants/pagination";
import type { GitCommit } from "../../src/shared/types";

function makeCommits(count: number, offset = 0): GitCommit[] {
  return Array.from({ length: count }, (_, i) => {
    const idx = offset + i;
    return {
      hash: `h${idx}`,
      shortHash: `h${idx}`,
      authorName: "u",
      authorEmail: "u@x",
      date: "2026-01-01T00:00:00Z",
      subject: `commit ${idx}`,
      refs: "",
      parents: idx + 1 < offset + count ? [`h${idx + 1}`] : [],
      body: "",
    };
  });
}

type HistoryOpts = { limit?: number; skip?: number };

interface Bridge {
  getStatus: ReturnType<typeof vi.fn>;
  getHistory: ReturnType<typeof vi.fn>;
  getBranches: ReturnType<typeof vi.fn>;
  stashList: ReturnType<typeof vi.fn>;
  watchRepository: ReturnType<typeof vi.fn>;
  unwatchRepository: ReturnType<typeof vi.fn>;
  onRepositoryChanged: ReturnType<typeof vi.fn>;
}

function installBridge(historyPages: GitCommit[][]): Bridge {
  let pageIdx = 0;
  const getHistory = vi.fn(async (_path: string, _opts?: HistoryOpts) => {
    const page = historyPages[pageIdx] ?? [];
    pageIdx++;
    return page;
  });
  const bridge: Bridge = {
    getStatus: vi.fn(async () => ({
      repoPath: "/repo",
      branch: "main",
      ahead: 0,
      behind: 0,
      clean: true,
      state: {
        operationState: "normal",
        detachedHead: false,
        mergeInProgress: false,
        rebaseInProgress: false,
        cherryPickInProgress: false,
      },
      conflicts: { hasConflicts: false, files: [] },
      changes: [],
    })),
    getHistory,
    getBranches: vi.fn(async () => []),
    stashList: vi.fn(async () => []),
    watchRepository: vi.fn(async () => ({ ok: true })),
    unwatchRepository: vi.fn(async () => ({ ok: true })),
    onRepositoryChanged: vi.fn(() => () => {}),
  };
  // Attach onto the existing window — do NOT replace it (that breaks React's scheduler).
  (window as unknown as { gitdeck: Bridge }).gitdeck = bridge;
  return bridge;
}

function clearBridge(): void {
  delete (window as unknown as { gitdeck?: Bridge }).gitdeck;
}

describe("useRepoData history pagination", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });
  afterEach(() => {
    clearBridge();
    vi.restoreAllMocks();
  });

  it("loads the first page on mount", async () => {
    const bridge = installBridge([makeCommits(HISTORY_PAGE_SIZE)]);
    const { result } = renderHook(() => useRepoData("/repo"));
    await waitFor(() => expect(result.current.data.history.length).toBe(HISTORY_PAGE_SIZE));
    expect(result.current.data.historyDone).toBe(false);
    expect(bridge.getHistory).toHaveBeenCalledWith("/repo", { limit: HISTORY_PAGE_SIZE, skip: 0 });
  });

  it("appends a second page when loadMoreHistory is called", async () => {
    const bridge = installBridge([
      makeCommits(HISTORY_PAGE_SIZE),
      makeCommits(HISTORY_PAGE_SIZE, HISTORY_PAGE_SIZE),
    ]);
    const { result } = renderHook(() => useRepoData("/repo"));
    await waitFor(() => expect(result.current.data.history.length).toBe(HISTORY_PAGE_SIZE));

    await act(async () => {
      await result.current.loadMoreHistory();
    });
    expect(result.current.data.history.length).toBe(HISTORY_PAGE_SIZE * 2);
    expect(result.current.data.historyDone).toBe(false);
    expect(bridge.getHistory).toHaveBeenLastCalledWith("/repo", {
      limit: HISTORY_PAGE_SIZE,
      skip: HISTORY_PAGE_SIZE,
    });
  });

  it("marks historyDone when a short page is returned", async () => {
    const bridge = installBridge([
      makeCommits(HISTORY_PAGE_SIZE),
      makeCommits(50, HISTORY_PAGE_SIZE),
    ]);
    const { result } = renderHook(() => useRepoData("/repo"));
    await waitFor(() => expect(result.current.data.history.length).toBe(HISTORY_PAGE_SIZE));

    await act(async () => {
      await result.current.loadMoreHistory();
    });
    expect(result.current.data.history.length).toBe(HISTORY_PAGE_SIZE + 50);
    expect(result.current.data.historyDone).toBe(true);

    const callCountBefore = bridge.getHistory.mock.calls.length;
    await act(async () => {
      await result.current.loadMoreHistory();
    });
    expect(bridge.getHistory.mock.calls.length).toBe(callCountBefore);
  });

  it("marks historyDone when the first page is shorter than PAGE_SIZE", async () => {
    installBridge([makeCommits(10)]);
    const { result } = renderHook(() => useRepoData("/repo"));
    await waitFor(() => expect(result.current.data.history.length).toBe(10));
    expect(result.current.data.historyDone).toBe(true);
  });

  it("ignores overlapping loadMoreHistory calls", async () => {
    const bridge = installBridge([
      makeCommits(HISTORY_PAGE_SIZE),
      makeCommits(HISTORY_PAGE_SIZE, HISTORY_PAGE_SIZE),
    ]);
    const { result } = renderHook(() => useRepoData("/repo"));
    await waitFor(() => expect(result.current.data.history.length).toBe(HISTORY_PAGE_SIZE));

    const callsBefore = bridge.getHistory.mock.calls.length;
    await act(async () => {
      const a = result.current.loadMoreHistory();
      const b = result.current.loadMoreHistory();
      await Promise.all([a, b]);
    });
    // only one extra fetch should have happened
    expect(bridge.getHistory.mock.calls.length).toBe(callsBefore + 1);
    expect(result.current.data.history.length).toBe(HISTORY_PAGE_SIZE * 2);
  });
});
