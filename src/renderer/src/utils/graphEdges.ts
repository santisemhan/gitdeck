import type { Commit } from "../data/types";

export const ROW_H = 30;
export const NODE_R = 7;
export const LANE_X = (lane: number): number => 14 + lane * 18;

export const LANE_PALETTE = [
  "#5adbc8",
  "#74b0f5",
  "#e5a155",
  "#b58cf5",
  "#e26565",
  "#f0c274",
];

export const laneColor = (lane: number): string => LANE_PALETTE[lane % LANE_PALETTE.length];

export interface GraphEdge {
  fromLane: number;
  toLane: number;
  fromY: number;
  toY: number;
  color: string;
  dashed: boolean;
}

/**
 * Build the SVG edge descriptors for the commit graph from a flat list of
 * commits. Edges target the commit's parents within the same list — parents
 * outside the rendered window are silently skipped (they reappear once more
 * history is paginated in).
 */
export function computeGraphEdges(commits: Commit[]): GraphEdge[] {
  const byId: Record<string, Commit> = {};
  const yById: Record<string, number> = {};
  commits.forEach((commit, index) => {
    byId[commit.id] = commit;
    yById[commit.id] = index * ROW_H + ROW_H / 2;
  });

  const edges: GraphEdge[] = [];
  for (const commit of commits) {
    commit.parents.forEach((pid, parentIdx) => {
      const parent = byId[pid];
      if (!parent) return;
      const fromY = yById[commit.id];
      const toY = yById[parent.id];
      if (!fromY || !toY) return;
      const fromLane = commit.lane;
      const toLane = parent.lane;
      const isMergeParent = commit.parents.length > 1 && parentIdx > 0;
      edges.push({
        fromLane,
        toLane,
        fromY,
        toY,
        color: laneColor(isMergeParent ? toLane : fromLane),
        dashed: !!commit.isStash,
      });
    });
  }
  return edges;
}
