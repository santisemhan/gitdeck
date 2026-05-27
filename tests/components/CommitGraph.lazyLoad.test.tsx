import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommitGraph } from "../../src/renderer/src/components/CommitGraph";
import type { Commit } from "../../src/renderer/src/data/types";
import { triggerAllIntersections, resetIntersectionObservers } from "../setup";

function makeCommit(id: string, parents: string[] = []): Commit {
  return {
    id,
    hash: id,
    title: id,
    author: "u",
    email: "u@x",
    dateISO: "2026-01-01T00:00:00Z",
    parents,
    parentsLanes: [],
    lane: 0,
  };
}

function noop() {}

function renderGraph(props: Partial<React.ComponentProps<typeof CommitGraph>>) {
  return render(
    <CommitGraph
      commits={[makeCommit("a"), makeCommit("b")]}
      selectedCommitId={undefined}
      onSelectCommit={noop}
      onSelectWip={noop}
      {...props}
    />,
  );
}

describe("CommitGraph lazy load sentinel", () => {
  beforeEach(() => resetIntersectionObservers());
  afterEach(() => {
    cleanup();
    resetIntersectionObservers();
  });

  it("calls onLoadMore when the sentinel becomes visible", () => {
    const onLoadMore = vi.fn();
    renderGraph({ onLoadMore, loadingMore: false, historyDone: false });
    triggerAllIntersections(true);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("does not call onLoadMore when loadingMore is true", () => {
    const onLoadMore = vi.fn();
    renderGraph({ onLoadMore, loadingMore: true, historyDone: false });
    triggerAllIntersections(true);
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("does not render the sentinel when historyDone is true", () => {
    const onLoadMore = vi.fn();
    const { queryByTestId } = renderGraph({ onLoadMore, historyDone: true });
    expect(queryByTestId("graph-sentinel")).toBeNull();
    triggerAllIntersections(true);
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("does not render the sentinel when onLoadMore is not provided", () => {
    const { queryByTestId } = renderGraph({});
    expect(queryByTestId("graph-sentinel")).toBeNull();
  });

  it("shows the loading caption while loadingMore", () => {
    const { getByTestId } = renderGraph({
      onLoadMore: noop,
      loadingMore: true,
      historyDone: false,
    });
    // sentinel still renders so the user sees the loading text; observer is just disabled
    expect(getByTestId("graph-sentinel").textContent).toContain("Loading more commits");
  });
});
