import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject } from "react";
import type { LocalBranch, RemoteBranch } from "../data/types";
import {
  IconArrowClockwise,
  IconArchiveDown,
  IconArchiveUp,
  IconBranch,
  IconCaretDown,
  IconCloudArrowDown,
  IconCloudArrowUp,
  IconTerminal,
} from "./icons";

interface ToolbarActionProps {
  icon: ReactNode;
  label: string;
  badge?: number;
  disabled?: boolean;
  split?: boolean;
  onClick?: () => void;
  onContextMenu?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}

function ToolbarAction({ icon, label, badge, disabled, split, onClick, onContextMenu }: ToolbarActionProps) {
  return (
    <button
      className={"toolbar-action" + (split ? " split-caret" : "")}
      disabled={disabled}
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={label}
    >
      <span className="ico">
        {icon}
        {badge != null && badge > 0 && <span className="badge">{badge}</span>}
      </span>
      <span className="lbl">{label}</span>
      {split && (
        <span className="caret">
          <IconCaretDown size={9} />
        </span>
      )}
    </button>
  );
}

interface RepoToolbarProps {
  repoName: string;
  currentBranch: string;
  statusAhead: number;
  statusBehind: number;
  stashCount: number;
  localBranches: LocalBranch[];
  remoteBranches: RemoteBranch[];
  currentBranchId?: string;
  branchMenuRef: RefObject<HTMLDivElement | null>;
  isBranchMenuOpen: boolean;
  branchQuery: string;
  filteredBranchMenuItems: Array<{ branch: LocalBranch | RemoteBranch; label: string }>;
  onToggleBranchMenu: () => void;
  onBranchQueryChange: (value: string) => void;
  onBranchSubmit: () => void;
  onBranchSelect: (branch: LocalBranch | RemoteBranch) => void;
  isPulling?: boolean;
  isPushing?: boolean;
  onPull: () => void;
  onPush: () => void;
  onPushRecentTag?: () => void;
  recentTagName?: string | null;
  onCreateBranch: () => void;
  onStash: () => void;
  onPop: () => void;
  onToggleTerminal: () => void;
}

export function RepoToolbar(props: RepoToolbarProps) {
  const [isPushMenuOpen, setIsPushMenuOpen] = useState(false);
  const pushMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isPushMenuOpen) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent) {
        const target = event.target as HTMLElement | null;
        if (target?.closest(".push-menu") || target?.closest(".push-menu-anchor")) return;
      }
      setIsPushMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [isPushMenuOpen]);

  return (
    <div className="toolbar">
      <div className="field">
        <span className="label">repository</span>
        <span className="value">{props.repoName}</span>
      </div>
      <div className="divider" />
      <div className="field branch-field" ref={props.branchMenuRef as RefObject<HTMLDivElement>}>
        <span className="label">branch</span>
        <button className="value branch-value-btn" title="Switch branch" onClick={props.onToggleBranchMenu}>
          {props.currentBranch}
          <IconCaretDown size={12} className="text-muted" />
        </button>
        {props.isBranchMenuOpen && (
          <div className="branch-menu">
            <input
              type="text"
              placeholder="Search branches"
              value={props.branchQuery}
              onChange={(event) => props.onBranchQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  props.onBranchSubmit();
                }
              }}
              autoFocus
            />
            <div className="branch-menu-list">
              {props.filteredBranchMenuItems.map(({ branch, label }) => {
                const isCurrent = branch.id === props.currentBranchId;
                return (
                  <button
                    key={branch.id}
                    className={"branch-menu-item" + (isCurrent ? " current" : "")}
                    onClick={() => void props.onBranchSelect(branch)}
                  >
                    <IconBranch size={12} />
                    <span>{label}</span>
                  </button>
                );
              })}
              {props.filteredBranchMenuItems.length === 0 && <div className="branch-menu-empty">No branches found</div>}
            </div>
          </div>
        )}
      </div>
      <div className="actions">
        <ToolbarAction
          icon={props.isPulling ? <IconArrowClockwise size={16} className="spin" /> : <IconCloudArrowDown size={16} />}
          label={props.isPulling ? "Pulling..." : "Pull"}
          badge={props.statusBehind}
          disabled={props.isPulling || props.isPushing}
          onClick={props.onPull}
        />
        <div className="push-menu-anchor" ref={pushMenuRef}>
          <ToolbarAction
            icon={props.isPushing ? <IconArrowClockwise size={16} className="spin" /> : <IconCloudArrowUp size={16} />}
            label={props.isPushing ? "Pushing..." : "Push"}
            badge={props.statusAhead}
            split
            disabled={props.isPushing || props.isPulling}
            onClick={props.onPush}
            onContextMenu={(event) => {
              event.preventDefault();
              if (props.isPushing || props.isPulling) return;
              setIsPushMenuOpen(true);
            }}
          />
          {isPushMenuOpen && (
            <div className="push-menu" role="menu" onMouseDown={(event) => event.stopPropagation()}>
              <button
                className="push-menu-item"
                role="menuitem"
                onClick={() => {
                  props.onPush();
                  setIsPushMenuOpen(false);
                }}
              >
                Push current branch
              </button>
              {props.onPushRecentTag && props.recentTagName && (
                <button
                  className="push-menu-item"
                  role="menuitem"
                  onClick={() => {
                    props.onPushRecentTag?.();
                    setIsPushMenuOpen(false);
                  }}
                >
                  Push tag {props.recentTagName}
                </button>
              )}
            </div>
          )}
        </div>
        <ToolbarAction icon={<IconBranch size={16} />} label="Branch" onClick={props.onCreateBranch} />
        <ToolbarAction icon={<IconArchiveDown size={16} />} label="Stash" onClick={props.onStash} />
        <ToolbarAction
          icon={<IconArchiveUp size={16} />}
          label="Pop"
          badge={props.stashCount}
          disabled={props.stashCount === 0}
          onClick={props.onPop}
        />
        <div className="divider divider-compact" />
        <ToolbarAction icon={<IconTerminal size={16} />} label="Terminal" onClick={props.onToggleTerminal} />
      </div>
    </div>
  );
}
