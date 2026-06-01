import { useState } from "react";
import { useRenameWorktree } from "../hooks/useRenameWorktree";
import type { WorktreeCtxMenuState } from "../data/types";
import { RenameWorktreeDialog } from "./RenameWorktreeDialog";
import type { WorktreeInfo } from "../../../shared/types";
import {
  IconBranch,
  IconCaretDown,
  IconCheck,
  IconFolder,
  IconTrash,
  IconPencil,
  IconArrowUp,
  IconArrowDown,
  IconArrowClockwise,
  IconPlus,
} from "./icons";

interface WorktreeSectionProps {
  worktrees?: WorktreeInfo[];
  loading?: boolean;
  error?: string | null;
  onSelectWorktree: (worktree: WorktreeInfo) => void;
  onSwitchWorktree: (worktree: WorktreeInfo) => void;
  onDeleteWorktree?: (worktree: WorktreeInfo) => void;
  onRenameWorktree?: (worktree: WorktreeInfo) => void;
  onOpenInFinder?: (worktree: WorktreeInfo) => void;
  onPruneWorktree?: (worktree: WorktreeInfo) => void;
  onAddWorktree?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function WorktreeSection({
  worktrees = [],
  loading = false,
  error = null,
  onSelectWorktree,
  onSwitchWorktree,
  onDeleteWorktree,
  onRenameWorktree,
  onOpenInFinder,
  onPruneWorktree,
  onAddWorktree,
  collapsed = false,
  onToggleCollapsed,
}: WorktreeSectionProps) {
  const renameHook = useRenameWorktree();

  const handleRename = (wt: WorktreeInfo) => {
    renameHook.open(wt);
  };
  const [ctxMenu, setCtxMenu] = useState<WorktreeCtxMenuState | null>(null);

  const handleContextMenu = (e: React.MouseEvent, worktree: WorktreeInfo) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, worktree });
  };

  const closeCtxMenu = () => setCtxMenu(null);

  const getRelativePath = (worktreePath: string, mainPath?: string) => {
    if (!mainPath) return worktreePath;
    const mainDir = mainPath.substring(0, mainPath.lastIndexOf("/"));
    if (worktreePath.startsWith(mainDir)) {
      return worktreePath.substring(mainDir.length + 1);
    }
    return worktreePath;
  };

  const mainWorktree = worktrees.find((w) => w.isMain);
  const linkedWorktrees = worktrees.filter((w) => !w.isMain);

  return (
    <div className={"section" + (!collapsed ? " expanded" : "")}>
      <div
        className={"section-header" + (collapsed ? " collapsed" : "")}
        onClick={onToggleCollapsed}
      >
        <IconCaretDown size={12} className="chevron" />
        <span className="icon"><IconFolder size={13} /></span>
        <span className="title">WORKTREES</span>
        <span className={"count" + (worktrees.length === 0 ? " zero" : "")}>
          {loading ? "..." : worktrees.length}
        </span>
        {onAddWorktree && (
          <button
            type="button"
            className="section-add-btn"
            title="Create worktree"
            aria-label="Create worktree"
            onClick={(e) => {
              e.stopPropagation();
              onAddWorktree();
            }}
          >
            <IconPlus size={12} />
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="section-body">
          {loading && <div className="empty-row">Loading worktrees...</div>}
          {error && <div className="empty-row">Error: {error}</div>}
          {!loading && !error && worktrees.length === 0 && (
            <div className="empty-row">No worktrees</div>
          )}
          {!loading && !error && mainWorktree && (
            <div
              className="branch-row"
              onClick={() => onSelectWorktree(mainWorktree)}
              onDoubleClick={() => onSwitchWorktree(mainWorktree)}
              onContextMenu={(e) => handleContextMenu(e, mainWorktree)}
              title={mainWorktree.path}
            >
              <IconCheck size={13} className="check" />
              <span className="name">
                {getRelativePath(mainWorktree.path, mainWorktree.path)}
              </span>
              {mainWorktree.hasChanges && (
                <span className="dirty-indicator" title="Has changes">M</span>
              )}
              <span className="worktree-badge main">main</span>
            </div>
          )}
          {!loading && !error && linkedWorktrees.map((worktree) => (
            <div
              key={worktree.path}
              className={"branch-row" + (worktree.isOrphaned ? " orphaned" : "")}
              onClick={() => onSelectWorktree(worktree)}
              onDoubleClick={() => onSwitchWorktree(worktree)}
              onContextMenu={(e) => handleContextMenu(e, worktree)}
              title={worktree.path}
            >
              {worktree.isOrphaned ? (
                <IconArrowDown size={13} className="icon warning" />
              ) : (
                <IconBranch size={13} className="icon" />
              )}
              <span className="name">
                {getRelativePath(worktree.path, mainWorktree?.path)}
              </span>
              {worktree.hasChanges && (
                <span className="dirty-indicator" title="Has changes">M</span>
              )}
              {worktree.branch && (
                <span className="worktree-branch">{worktree.branch}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {ctxMenu && (
        <div
          className="ctx-menu"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
          role="menu"
        >
          {!ctxMenu.worktree.isMain && !ctxMenu.worktree.isOrphaned && onDeleteWorktree && (
            <button
              type="button"
              className="ctx-menu-item"
              role="menuitem"
              onClick={() => {
                onDeleteWorktree(ctxMenu.worktree);
                closeCtxMenu();
              }}
            >
              <IconTrash size={13} /> Delete Worktree
            </button>
          )}
          {!ctxMenu.worktree.isMain && !ctxMenu.worktree.isOrphaned && onRenameWorktree && (
            <button
              type="button"
              className="ctx-menu-item"
              role="menuitem"
              onClick={() => {
                onRenameWorktree(ctxMenu.worktree);
                closeCtxMenu();
              }}
            >
              <IconPencil size={13} /> Rename
            </button>
          )}
          {!ctxMenu.worktree.isOrphaned && onOpenInFinder && (
            <button
              type="button"
              className="ctx-menu-item"
              role="menuitem"
              onClick={() => {
                onOpenInFinder(ctxMenu.worktree);
                closeCtxMenu();
              }}
            >
              <IconArrowUp size={13} /> Open in Finder
            </button>
          )}
          {ctxMenu.worktree.isOrphaned && onPruneWorktree && (
            <button
              type="button"
              className="ctx-menu-item ctx-menu-item-danger"
              role="menuitem"
              onClick={() => {
                onPruneWorktree(ctxMenu.worktree);
                closeCtxMenu();
              }}
            >
              <IconTrash size={13} /> Prune
            </button>
          )}
        </div>
      )}
    </div>
  );
}
