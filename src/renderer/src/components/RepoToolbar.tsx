import type { ReactNode, RefObject } from "react";
import type { LocalBranch, RemoteBranch } from "../data/types";
import {
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
}

function ToolbarAction({ icon, label, badge, disabled, split, onClick }: ToolbarActionProps) {
  return (
    <button
      className={"toolbar-action" + (split ? " split-caret" : "")}
      disabled={disabled}
      onClick={onClick}
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
  onPull: () => void;
  onPush: () => void;
  onCreateBranch: () => void;
  onStash: () => void;
  onPop: () => void;
  onToggleTerminal: () => void;
}

export function RepoToolbar(props: RepoToolbarProps) {
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
        <ToolbarAction icon={<IconCloudArrowDown size={16} />} label="Pull" badge={props.statusBehind} onClick={props.onPull} />
        <ToolbarAction icon={<IconCloudArrowUp size={16} />} label="Push" badge={props.statusAhead} onClick={props.onPush} />
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
