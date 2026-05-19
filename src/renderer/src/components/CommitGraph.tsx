import { useMemo } from "react";
import type { Commit, CommitRef } from "../data/types";
import {
  IconCaretDown,
  IconCheck,
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
}

export function CommitGraph({
  commits,
  selectedCommitId,
  onSelectCommit,
  onSelectWip,
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Commit message</span>
          <span className="right">
            <button className="gear" title="Graph settings">
              <IconGear size={14} />
            </button>
          </span>
        </div>
      </div>

      <div className="graph-scroll">
        <div style={{ position: "relative" }}>
          <svg
            width={svgW}
            height={totalH}
            style={{
              position: "absolute",
              top: 0,
              left: 200,
              width: svgW,
              height: totalH,
              pointerEvents: "none",
              zIndex: 2,
              overflow: "visible",
              shapeRendering: "geometricPrecision",
            }}
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
              let d: string;

              if (dy <= 2 * TR) {
                d =
                  `M ${fromX} ${fromY} ` +
                  `C ${fromX} ${fromY + dy * 0.55}, ${toX} ${toY - dy * 0.55}, ${toX} ${toY}`;
              } else {
                const curveAtTop = e.fromLane < e.toLane;
                if (curveAtTop) {
                  d =
                    `M ${fromX} ${fromY} ` +
                    `C ${fromX} ${fromY + TR}, ${toX} ${fromY + TR}, ${toX} ${fromY + 2 * TR} ` +
                    `L ${toX} ${toY}`;
                } else {
                  d =
                    `M ${fromX} ${fromY} ` +
                    `L ${fromX} ${toY - 2 * TR} ` +
                    `C ${fromX} ${toY - TR}, ${toX} ${toY - TR}, ${toX} ${toY}`;
                }
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
}

function CommitRow({ commit, selected, onSelect }: CommitRowProps) {
  const c = commit;

  return (
    <div
      className={"commit-row" + (selected ? " selected" : "") + (c.isWip ? " wip-row" : "")}
      role="listitem"
      onClick={onSelect}
    >
      <div className="commit-row-cell labels">
        {(c.refs || []).map((r, idx) => (
          <RefPill key={idx} refData={r} first={idx === 0} />
        ))}
      </div>

      <div className="commit-row-cell graph" style={{ background: "transparent" }} />

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

function RefPill({ refData, first }: { refData: CommitRef; first: boolean }) {
  if (refData.kind === "more") {
    return (
      <span
        className="branch-pill"
        style={{ background: "var(--bg-3)", color: "var(--text-3)", fontSize: 10 }}
      >
        +{refData.count}
      </span>
    );
  }
  return (
    <span className={"branch-pill" + (refData.current ? " current" : "")} title={refData.name}>
      {refData.current && <IconCheck size={10} className="check" />}
      <span className="pname">{refData.name}</span>
      <IconMonitor size={10} style={{ color: "var(--text-3)", flexShrink: 0 }} />
      {first && refData.current && (
        <IconCaretDown size={9} style={{ color: "var(--text-3)" }} />
      )}
    </span>
  );
}
