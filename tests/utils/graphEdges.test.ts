import { describe, expect, it } from "vitest";
import {
  computeGraphEdges,
  LANE_PALETTE,
  LANE_X,
  NODE_R,
  ROW_H,
  laneColor,
} from "../../src/renderer/src/utils/graphEdges";
import type { Commit } from "../../src/renderer/src/data/types";

function commit(partial: Partial<Commit> & Pick<Commit, "id">): Commit {
  return {
    id: partial.id,
    hash: partial.hash ?? partial.id,
    title: partial.title ?? partial.id,
    author: partial.author ?? "u",
    email: partial.email ?? "u@x",
    dateISO: partial.dateISO ?? "2026-01-01T00:00:00Z",
    parents: partial.parents ?? [],
    parentsLanes: partial.parentsLanes ?? [],
    lane: partial.lane ?? 0,
    isWip: partial.isWip,
    isMerge: partial.isMerge,
    isStash: partial.isStash,
  };
}

describe("graphEdges layout constants", () => {
  it("LANE_X spaces lanes by 18px starting at 14", () => {
    expect(LANE_X(0)).toBe(14);
    expect(LANE_X(1)).toBe(32);
    expect(LANE_X(2)).toBe(50);
  });

  it("laneColor cycles through LANE_PALETTE", () => {
    expect(laneColor(0)).toBe(LANE_PALETTE[0]);
    expect(laneColor(LANE_PALETTE.length)).toBe(LANE_PALETTE[0]);
    expect(laneColor(LANE_PALETTE.length + 1)).toBe(LANE_PALETTE[1]);
  });

  it("ROW_H and NODE_R are sane", () => {
    expect(ROW_H).toBeGreaterThan(0);
    expect(NODE_R).toBeGreaterThan(0);
  });
});

describe("computeGraphEdges", () => {
  it("returns no edges for a single commit", () => {
    expect(computeGraphEdges([commit({ id: "a" })])).toEqual([]);
  });

  it("emits one edge per parent in a linear chain", () => {
    const edges = computeGraphEdges([
      commit({ id: "a", parents: ["b"] }),
      commit({ id: "b", parents: ["c"] }),
      commit({ id: "c" }),
    ]);
    expect(edges).toHaveLength(2);
    expect(edges[0].fromLane).toBe(0);
    expect(edges[0].toLane).toBe(0);
    expect(edges[0].fromY).toBe(ROW_H / 2);
    expect(edges[0].toY).toBe(ROW_H + ROW_H / 2);
  });

  it("colors merge second-parent edges by the parent's lane", () => {
    const edges = computeGraphEdges([
      commit({ id: "m", parents: ["p1", "p2"], lane: 0 }),
      commit({ id: "p1", lane: 0 }),
      commit({ id: "p2", lane: 1 }),
    ]);
    const firstParentEdge = edges.find((e) => e.toY === ROW_H + ROW_H / 2);
    const secondParentEdge = edges.find((e) => e.toY === 2 * ROW_H + ROW_H / 2);
    expect(firstParentEdge?.color).toBe(laneColor(0));
    expect(secondParentEdge?.color).toBe(laneColor(1));
  });

  it("marks stash edges as dashed", () => {
    const edges = computeGraphEdges([
      commit({ id: "s", parents: ["p"], isStash: true }),
      commit({ id: "p" }),
    ]);
    expect(edges).toHaveLength(1);
    expect(edges[0].dashed).toBe(true);
  });

  it("regular (non-stash) commits produce solid edges", () => {
    const edges = computeGraphEdges([
      commit({ id: "a", parents: ["b"] }),
      commit({ id: "b" }),
    ]);
    expect(edges[0].dashed).toBe(false);
  });

  it("skips edges whose parent is not in the list (off-window)", () => {
    const edges = computeGraphEdges([
      commit({ id: "orphan", parents: ["never-loaded"] }),
    ]);
    expect(edges).toEqual([]);
  });
});
