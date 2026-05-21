import { useMemo } from "react";
import type { Commit, CommitRef } from "../data/types";
import {
  IconCaretDown,
  IconGear,
  IconMonitor,
  IconPlus,
} from "./icons";

const LANE_PALETTE = [
  "#5adbc8",
  "#74b0f5",
  "#e5a155",
  "#b58cf5",
  "#e26565",
  "#f0c274",
];
const laneColor = (lane: number) => LANE_PALETTE[lane % LANE_PALETTE.length];

const ROW_H = 30;
const NODE_R = 7;
const LANE_X = (lane: number) => 14 + lane * 18;

interface CommitGraphProps {
  commits: Commit[];
  selectedCommitId?: string;
  onSelectCommit: (commit: Commit) => void;
  onSelectWip: () => void;
  onCheckoutRef?: (refName: string) => void;
}

export function CommitGraph({
  commits,
  selectedCommitId,
  onSelectCommit,
  onSelectWip,
  onCheckoutRef,
}: CommitGraphProps) {
  const byId = useMemo(() => {
    const m: Record<string, Commit & { rowIdx: number }> = {};
    commits.forEach((c, i) => {
      m[c.id] = { ...c, rowIdx: i };
    });
    return m;
  }, [commits]);

  const edges = useMemo(() => {
    const result: {
      fromLane: number;
      toLane: number;
      fromRow: number;
      toRow: number;
      color: string;
    }[] = [];
    commits.forEach((c, i) => {
      c.parents.forEach((pid) => {
        const parent = byId[pid];
        if (!parent) return;
        const fromLane = c.lane;
        const toLane = parent.lane;
        result.push({
          fromLane,
          toLane,
          fromRow: i,
          toRow: parent.rowIdx,
          color: laneColor(toLane !== fromLane ? toLane : fromLane),
        });
      });
    });
    return result;
  }, [commits, byId]);

  const totalH = commits.length * ROW_H;
  const svgW = 60;

  return (
    <>
      <div className="graph-header">
        <div>
          <span>Branch</span>
          <span className="sep"> / </span>
          <span>Tag</span>
        </div>
        <div>Graph</div>
        <div className="graph-header-row">
          <span>Commit message</span>
          <span className="right">
            <button className="gear" title="Graph settings">
              <IconGear size={14} />
            </button>
          </span>
        </div>
      </div>

      <div className="graph-scroll">
        <div className="graph-stack">
          <svg
            width={svgW}
            height={totalH}
            className="graph-svg-overlay"
          >
            {edges.map((e, i) => {
              const fromX = LANE_X(e.fromLane);
              const toX = LANE_X(e.toLane);
              const fromY = e.fromRow * ROW_H + ROW_H / 2;
              const toY = e.toRow * ROW_H + ROW_H / 2;
              const dy = toY - fromY;

              if (fromX === toX) {
                return (
                  <line
                    key={i}
                    x1={fromX}
                    y1={fromY}
                    x2={toX}
                    y2={toY}
                    stroke={e.color}
                    strokeWidth="2.2"
                  />
                );
              }

              const TR = 10;
              const R = Math.min(6, dy / 2);
              const bendOffset = Math.min(TR, dy / 2);
              const curveAtTop = e.fromLane < e.toLane;

              let d: string;
              if (curveAtTop) {
                // Exit bottom → go right → continue down to target
                const bendY = fromY + bendOffset;
                d =
                  `M ${fromX} ${fromY} ` +
                  `L ${fromX} ${bendY - R} ` +
                  `Q ${fromX} ${bendY}, ${fromX + R} ${bendY} ` +
                  `L ${toX - R} ${bendY} ` +
                  `Q ${toX} ${bendY}, ${toX} ${bendY + R} ` +
                  `L ${toX} ${toY}`;
              } else {
                // Exit bottom → continue down → go left → enter target from top
                const bendY = toY - bendOffset;
                d =
                  `M ${fromX} ${fromY} ` +
                  `L ${fromX} ${bendY - R} ` +
                  `Q ${fromX} ${bendY}, ${fromX - R} ${bendY} ` +
                  `L ${toX + R} ${bendY} ` +
                  `Q ${toX} ${bendY}, ${toX} ${bendY + R} ` +
                  `L ${toX} ${toY}`;
              }

              return (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke={e.color}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}

            {commits.map((c, i) => {
              const cx = LANE_X(c.lane);
              const cy = i * ROW_H + ROW_H / 2;
              const color = laneColor(c.lane);
              const sel = c.id === selectedCommitId;

              if (c.isWip) {
                return (
                  <g key={c.id}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={NODE_R + 1}
                      fill="var(--bg-1)"
                      stroke={color}
                      strokeWidth="2"
                      strokeDasharray="3 2"
                    />
                  </g>
                );
              }

              if (c.isMerge) {
                return (
                  <g key={c.id}>
                    <circle cx={cx} cy={cy} r={NODE_R + 1} fill="var(--bg-1)" stroke={color} strokeWidth="2.5" />
                    <circle cx={cx} cy={cy} r={2.5} fill={sel ? color : "var(--bg-3)"} />
                  </g>
                );
              }

              return (
                <g key={c.id}>
                  <circle cx={cx} cy={cy} r={NODE_R} fill="var(--bg-1)" stroke={color} strokeWidth="2.5" />
                  <circle cx={cx} cy={cy} r={2.8} fill={sel ? color : "var(--bg-3)"} />
                </g>
              );
            })}
          </svg>

          <div className="graph-list" role="list">
            {commits.map((c) => (
              <CommitRow
                key={c.id}
                commit={c}
                selected={c.id === selectedCommitId}
                onSelect={() => (c.isWip ? onSelectWip() : onSelectCommit(c))}
                onCheckoutRef={onCheckoutRef}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

interface CommitRowProps {
  commit: Commit;
  selected: boolean;
  onSelect: () => void;
  onCheckoutRef?: (refName: string) => void;
}

function CommitRow({ commit, selected, onSelect, onCheckoutRef }: CommitRowProps) {
  const c = commit;

  return (
    <div
      className={"commit-row" + (selected ? " selected" : "") + (c.isWip ? " wip-row" : "")}
      role="listitem"
      onClick={onSelect}
    >
      <div className="commit-row-cell labels">
        {(c.refs || []).map((r, idx) => (
          <RefPill key={idx} refData={r} first={idx === 0} onCheckoutRef={onCheckoutRef} />
        ))}
      </div>

      <div className="commit-row-cell graph" />

      <div className="commit-row-cell msg">
        {c.isWip ? (
          <>
            <span className="wip-input">{c.title}</span>
            <span className="add-count">
              <IconPlus size={11} /> {c.additions}
            </span>
          </>
        ) : (
          <span className="commit-msg">
            <span className="title">{c.title}</span>
            {c.body && (
              <span className="desc">{c.body.replace(/\n+/g, " ").slice(0, 200)}</span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

function RefPill({
  refData,
  first,
  onCheckoutRef,
}: {
  refData: CommitRef;
  first: boolean;
  onCheckoutRef?: (refName: string) => void;
}) {
  if (refData.kind === "more") {
    return (
      <span className="branch-pill branch-pill-more">
        +{refData.count}
      </span>
    );
  }
  return (
    <span
      className={
        "branch-pill" +
        (refData.current ? " current" : "") +
        (refData.kind === "branch" ? " checkoutable" : "")
      }
      title={
        refData.kind === "branch"
          ? `${refData.name} (double click to checkout)`
          : refData.name
      }
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (refData.kind !== "branch" || !refData.name) return;
        onCheckoutRef?.(refData.name);
      }}
    >
      <span className="pname">{refData.name}</span>
      <IconMonitor size={10} className="icon-muted-shrink" />
      {first && refData.current && (
        <IconCaretDown size={9} className="text-muted" />
      )}
    </span>
  );
}
