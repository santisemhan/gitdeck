import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import type { Commit, CommitRef } from "../data/types";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { dateGroupLabel, toDateGroup, type DateGroup } from "../utils/date";
import {
  IconCaretDown,
  IconCloud,
  IconGear,
  IconMonitor,
  IconTag,
} from "./icons";
import { FileStatusIcon } from "./FileStatusIcon";

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

function readStoredNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredNumber(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
  }
}

type BranchCtxMenu = { x: number; y: number; refName: string; isCurrent: boolean; isRemote: boolean };
type StashCtxMenu  = { x: number; y: number; index: number; message: string };
type CommitCtxMenu = { x: number; y: number; hash: string; title: string };

interface CommitGraphProps {
  commits: Commit[];
  selectedCommitId?: string;
  onSelectCommit: (commit: Commit) => void;
  onSelectWip: () => void;
  onCheckoutRef?: (refName: string) => void;
  onCreateBranchFrom?: (refName: string) => void;
  onDeleteBranch?: (refName: string) => void;
  onRequestRenameBranch?: (name: string) => void;
  onStashPop?: (index: number) => void;
  onStashApply?: (index: number) => void;
  onStashDrop?: (index: number) => void;
  onCherryPick?: (hash: string) => void;
  onRevertCommit?: (hash: string) => void;
}

export function CommitGraph({
  commits,
  selectedCommitId,
  onSelectCommit,
  onSelectWip,
  onCheckoutRef,
  onCreateBranchFrom,
  onDeleteBranch,
  onRequestRenameBranch,
  onStashPop,
  onStashApply,
  onStashDrop,
  onCherryPick,
  onRevertCommit,
}: CommitGraphProps) {
  const now = useMemo(() => new Date(), [commits]);
  const rows = useMemo(() => {
    const result: Array<{ commit: Commit; dateLabel?: string }> = [];
    let lastGroup: DateGroup | null = null;

    for (const commit of commits) {
      const group = toDateGroup(commit.dateISO, now);
      const nextLabel = dateGroupLabel(group);
      const dateLabel = group !== lastGroup && nextLabel !== "0 months ago" ? nextLabel : undefined;
      result.push({ commit, dateLabel });
      if (group !== lastGroup) {
        lastGroup = group;
      }
    }

    return result;
  }, [commits, now]);

  const commitYById = useMemo(
    () => Object.fromEntries(commits.map((c, i) => [c.id, i * ROW_H + ROW_H / 2])),
    [commits]
  );

  const [columns, setColumns] = useState(() => ({
    labels: Math.max(140, readStoredNumber(STORAGE_KEYS.commitGraphLabelsWidth, 200)),
    graph: Math.max(60, readStoredNumber(STORAGE_KEYS.commitGraphWidth, 60)),
  }));
  const resizeRef = useRef<{ key: "labels" | "graph"; startX: number; startWidth: number } | null>(null);

  const requiredGraphWidth = useMemo(() => {
    const maxLane = commits.reduce((max, commit) => Math.max(max, commit.lane), 0);
    return Math.max(60, LANE_X(maxLane) + NODE_R + 10);
  }, [commits]);

  const minWidths = useMemo(
    () => ({ labels: 140, graph: requiredGraphWidth }),
    [requiredGraphWidth]
  );

  const startResize = useCallback(
    (key: "labels" | "graph") => (event: ReactMouseEvent) => {
      event.preventDefault();
      resizeRef.current = { key, startX: event.clientX, startWidth: columns[key] };
    },
    [columns]
  );

  useEffect(() => {
    const onPointerMove = (event: MouseEvent) => {
      const active = resizeRef.current;
      if (!active) return;
      const nextWidth = Math.max(minWidths[active.key], active.startWidth + (event.clientX - active.startX));
      setColumns((prev) => ({ ...prev, [active.key]: nextWidth }));
    };
    const stopResize = () => {
      resizeRef.current = null;
    };
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", stopResize);
    return () => {
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", stopResize);
    };
  }, [minWidths]);

  useEffect(() => {
    setColumns((prev) => {
      if (prev.graph >= requiredGraphWidth) return prev;
      return { ...prev, graph: requiredGraphWidth };
    });
  }, [requiredGraphWidth]);

  useEffect(() => {
    writeStoredNumber(STORAGE_KEYS.commitGraphLabelsWidth, columns.labels);
  }, [columns.labels]);

  useEffect(() => {
    writeStoredNumber(STORAGE_KEYS.commitGraphWidth, columns.graph);
  }, [columns.graph]);

  const byId = useMemo(() => {
    const m: Record<string, Commit> = {};
    commits.forEach((c) => {
      m[c.id] = c;
    });
    return m;
  }, [commits]);

  const edges = useMemo(() => {
    const result: {
      fromLane: number;
      toLane: number;
      fromY: number;
      toY: number;
      color: string;
      dashed: boolean;
    }[] = [];
    commits.forEach((c) => {
      c.parents.forEach((pid, parentIdx) => {
        const parent = byId[pid];
        if (!parent) return;
        const fromY = commitYById[c.id];
        const toY = commitYById[parent.id];
        if (!fromY || !toY) return;
        const fromLane = c.lane;
        const toLane = parent.lane;
        const isMergeParent = c.parents.length > 1 && parentIdx > 0;
        result.push({
          fromLane,
          toLane,
          fromY,
          toY,
          color: laneColor(isMergeParent ? toLane : fromLane),
          dashed: !!c.isStash,
        });
      });
    });
    return result;
  }, [commits, byId, commitYById]);

  const [branchCtxMenu, setBranchCtxMenu] = useState<BranchCtxMenu | null>(null);
  const [stashCtxMenu,  setStashCtxMenu]  = useState<StashCtxMenu  | null>(null);
  const [commitCtxMenu, setCommitCtxMenu] = useState<CommitCtxMenu | null>(null);

  useEffect(() => {
    if (!branchCtxMenu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      setBranchCtxMenu(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [branchCtxMenu]);

  useEffect(() => {
    if (!stashCtxMenu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      setStashCtxMenu(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [stashCtxMenu]);

  useEffect(() => {
    if (!commitCtxMenu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      setCommitCtxMenu(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [commitCtxMenu]);

  const handleCommitContextMenu = useCallback(
    (hash: string, title: string, x: number, y: number) => {
      setCommitCtxMenu({ x, y, hash, title });
    },
    []
  );

  const handleRefContextMenu = useCallback(
    (refName: string, isCurrent: boolean, isRemote: boolean, x: number, y: number) => {
      setBranchCtxMenu({ x, y, refName, isCurrent, isRemote });
    },
    []
  );

  const handleStashContextMenu = useCallback(
    (index: number, message: string, x: number, y: number) => {
      setStashCtxMenu({ x, y, index, message });
    },
    []
  );

  const totalH = commits.length * ROW_H;
  const svgW = columns.graph;
  const graphGrid = {
    ["--branch-col" as string]: `${columns.labels}px`,
    ["--graph-col" as string]: `${columns.graph}px`,
  } as CSSProperties;

  return (
    <>
      <div className="graph-shell" style={graphGrid}>
        <div className="graph-header">
          <div className="graph-header-cell">
            <span>Branch</span>
            <span className="sep"> / </span>
            <span>Tag</span>
            <button className="col-resizer" onMouseDown={startResize("labels")} aria-label="Resize Branch/Tag column" />
          </div>
          <div className="graph-header-cell">
            <span>Graph</span>
            <button className="col-resizer" onMouseDown={startResize("graph")} aria-label="Resize Graph column" />
          </div>
          <div className="graph-header-row graph-header-cell">
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
              const fromY = e.fromY;
              const toY = e.toY;
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
                    strokeDasharray={e.dashed ? "4 3" : undefined}
                  />
                );
              }

              const R = Math.min(6, dy / 2);
              const curveAtTop = e.fromLane < e.toLane;

              let d: string;
              if (curveAtTop) {
                // Exit right → go right at same level → curve down to target
                d =
                  `M ${fromX + NODE_R} ${fromY} ` +
                  `L ${toX - R} ${fromY} ` +
                  `Q ${toX} ${fromY}, ${toX} ${fromY + R} ` +
                  `L ${toX} ${toY}`;
              } else {
                // Branch point exits right → goes right → curves up → enters branch child from below
                d =
                  `M ${toX + NODE_R} ${toY} ` +
                  `L ${fromX - R} ${toY} ` +
                  `Q ${fromX} ${toY}, ${fromX} ${toY - R} ` +
                  `L ${fromX} ${fromY + NODE_R}`;
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
                  strokeDasharray={e.dashed ? "4 3" : undefined}
                />
              );
            })}

            {commits.map((c) => {
              const cx = LANE_X(c.lane);
              const cy = commitYById[c.id] ?? ROW_H / 2;
              const color = laneColor(c.lane);
              const sel = c.id === selectedCommitId;

              if (c.isStash) {
                const s = NODE_R;
                const points = `${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`;
                return (
                  <g
                    key={c.id}
                    className="stash-marker"
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleStashContextMenu(c.stashIndex ?? 0, c.stashMessage || "", event.clientX, event.clientY);
                    }}
                  >
                    <polygon
                      points={points}
                      fill="var(--bg-1)"
                      stroke={color}
                      strokeWidth="2"
                      strokeDasharray="3 2"
                      strokeLinejoin="round"
                    />
                  </g>
                );
              }

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
              {rows.map((row) => {
                const c = row.commit;
                return (
                  <CommitRow
                    key={c.id}
                    commit={c}
                    selected={c.id === selectedCommitId}
                    dateLabel={row.dateLabel}
                    onSelect={() => (c.isWip ? onSelectWip() : onSelectCommit(c))}
                    onCheckoutRef={onCheckoutRef}
                    onRefContextMenu={handleRefContextMenu}
                    onStashContextMenu={handleStashContextMenu}
                    onCommitContextMenu={handleCommitContextMenu}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {branchCtxMenu && (
        <div
          className="ctx-menu"
          style={{ left: branchCtxMenu.x, top: branchCtxMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
          role="menu"
        >
          <>
            <button
              type="button"
              className="ctx-menu-item"
              role="menuitem"
              onClick={() => {
                onCreateBranchFrom?.(branchCtxMenu.refName);
                setBranchCtxMenu(null);
              }}
            >
              New branch from here
            </button>
            {!branchCtxMenu.isRemote && (
              <>
                <button
                  type="button"
                  className="ctx-menu-item"
                  role="menuitem"
                  onClick={() => {
                    onRequestRenameBranch?.(branchCtxMenu.refName);
                    setBranchCtxMenu(null);
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="ctx-menu-item ctx-menu-item-danger"
                  role="menuitem"
                  disabled={branchCtxMenu.isCurrent}
                  title={branchCtxMenu.isCurrent ? "Cannot delete the current branch" : undefined}
                  onClick={() => {
                    onDeleteBranch?.(branchCtxMenu.refName);
                    setBranchCtxMenu(null);
                  }}
                >
                  Delete branch
                </button>
              </>
            )}
          </>
        </div>
      )}

      {stashCtxMenu && (
        <div
          className="ctx-menu"
          style={{ left: stashCtxMenu.x, top: stashCtxMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
          role="menu"
        >
          <button
            type="button"
            className="ctx-menu-item"
            role="menuitem"
            onClick={() => {
              onStashPop?.(stashCtxMenu.index);
              setStashCtxMenu(null);
            }}
          >
            Pop
          </button>
          <button
            type="button"
            className="ctx-menu-item"
            role="menuitem"
            onClick={() => {
              onStashApply?.(stashCtxMenu.index);
              setStashCtxMenu(null);
            }}
          >
            Apply
          </button>
          <button
            type="button"
            className="ctx-menu-item ctx-menu-item-danger"
            role="menuitem"
            onClick={() => {
              onStashDrop?.(stashCtxMenu.index);
              setStashCtxMenu(null);
            }}
          >
            Drop
          </button>
        </div>
      )}

      {commitCtxMenu && (
        <div
          className="ctx-menu"
          style={{ left: commitCtxMenu.x, top: commitCtxMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
          role="menu"
        >
          <button
            type="button"
            className="ctx-menu-item"
            role="menuitem"
            onClick={() => {
              onCherryPick?.(commitCtxMenu.hash);
              setCommitCtxMenu(null);
            }}
          >
            Cherry pick commit
          </button>
          <button
            type="button"
            className="ctx-menu-item"
            role="menuitem"
            onClick={() => {
              onRevertCommit?.(commitCtxMenu.hash);
              setCommitCtxMenu(null);
            }}
          >
            Revert commit
          </button>
        </div>
      )}
    </>
  );
}

interface CommitRowProps {
  commit: Commit;
  selected: boolean;
  dateLabel?: string;
  onSelect: () => void;
  onCheckoutRef?: (refName: string) => void;
  onRefContextMenu?: (refName: string, isCurrent: boolean, isRemote: boolean, x: number, y: number) => void;
  onStashContextMenu?: (index: number, message: string, x: number, y: number) => void;
  onCommitContextMenu?: (hash: string, title: string, x: number, y: number) => void;
}

function CommitRow({ commit, selected, dateLabel, onSelect, onCheckoutRef, onRefContextMenu, onStashContextMenu, onCommitContextMenu }: CommitRowProps) {
  const c = commit;

  return (
    <div
      className={
        "commit-row" +
        (selected ? " selected" : "") +
        (dateLabel ? " with-date-divider" : "") +
        (c.isWip ? " wip-row" : "") +
        (c.isStash ? " stash-row" : "")
      }
      role="listitem"
      onClick={onSelect}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (c.isStash) {
          onStashContextMenu?.(c.stashIndex ?? 0, c.stashMessage || "", event.clientX, event.clientY);
        } else if (!c.isWip) {
          onCommitContextMenu?.(c.id, c.title, event.clientX, event.clientY);
        }
      }}
    >
      <div className="commit-row-cell labels">
        {(c.refs || []).map((r, idx) => (
          <RefPill
            key={idx}
            refData={r}
            first={idx === 0}
            onCheckoutRef={onCheckoutRef}
            onContextMenu={onRefContextMenu}
          />
        ))}
      </div>

      <div className="commit-row-cell graph" />

      <div className="commit-row-cell msg">
        {dateLabel && <span className="commit-date-chip">{dateLabel}</span>}
        {c.isWip ? (
          <>
            <span className="wip-input">{c.title}</span>
            <span className="wip-counts">
              {!!c.wipCounts?.added && (
                <span className="wip-count-item">
                  <FileStatusIcon status="added" size={11} />
                  <span className="wip-count-number add">{c.wipCounts.added}</span>
                </span>
              )}
              {!!c.wipCounts?.modified && (
                <span className="wip-count-item">
                  <FileStatusIcon status="modified" size={11} />
                  <span className="wip-count-number mod">{c.wipCounts.modified}</span>
                </span>
              )}
              {!!c.wipCounts?.deleted && (
                <span className="wip-count-item">
                  <FileStatusIcon status="deleted" size={11} />
                  <span className="wip-count-number del">{c.wipCounts.deleted}</span>
                </span>
              )}
              {!!c.wipCounts?.renamed && (
                <span className="wip-count-item">
                  <FileStatusIcon status="renamed" size={11} />
                  <span className="wip-count-number ren">{c.wipCounts.renamed}</span>
                </span>
              )}
            </span>
          </>
        ) : c.isStash ? (
          <span className="stash-pill">
            <span className="stash-tag">stash</span>
            <span className="stash-name">{c.stashMessage || c.title}</span>
          </span>
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
  onContextMenu,
}: {
  refData: CommitRef;
  first: boolean;
  onCheckoutRef?: (refName: string) => void;
  onContextMenu?: (refName: string, isCurrent: boolean, isRemote: boolean, x: number, y: number) => void;
}) {
  if (refData.kind === "more") {
    return (
      <span className="branch-pill branch-pill-more">
        +{refData.count}
      </span>
    );
  }

  const isTag = refData.kind === "tag";
  const hasLocal = !isTag && (refData.hasLocal ?? !refData.remote);
  const hasRemote = !isTag && !!refData.remote;
  // A pill is "remote-only" when there is no local branch — used to hide Rename/Delete
  const remoteOnly = hasRemote && !hasLocal;

  return (
    <span
      className={
        "branch-pill" +
        (refData.current ? " current" : "") +
        (remoteOnly ? " remote" : "") +
        (refData.kind === "branch" ? " checkoutable" : "")
      }
      title={refData.kind === "branch" ? `${refData.name} (double click to checkout)` : refData.name}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (refData.kind !== "branch" || !refData.name) return;
        onCheckoutRef?.(refData.name);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (refData.kind !== "branch" || !refData.name) return;
        onContextMenu?.(refData.name, !!refData.current, remoteOnly, event.clientX, event.clientY);
      }}
    >
      <span className="pname">{refData.name}</span>
      {isTag && <IconTag size={10} className="icon-muted-shrink" />}
      {hasLocal && <IconMonitor size={10} className="icon-muted-shrink" />}
      {hasRemote && <IconCloud size={10} className="icon-muted-shrink" />}
      {first && refData.current && (
        <IconCaretDown size={9} className="text-muted" />
      )}
    </span>
  );
}
