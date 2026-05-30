import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { LocalBranch, RemoteBranch } from "../data/types";
import type { WorktreeInfo } from "../../../shared/types";
import { useContextMenu } from "../hooks/useContextMenu";
import {
  IconArrowDown,
  IconArrowUp,
  IconBranch,
  IconCaretDown,
  IconCaretLeft,
  IconCaretRight,
  IconCheck,
  IconCloud,
  IconFolder,
  IconMonitor,
} from "./icons";
import { WorktreeSection } from "./WorktreeSection";
import { CreateWorktreeDialog } from "./CreateWorktreeDialog";

interface BranchSidebarProps {
  localBranches: LocalBranch[];
  remoteBranches: RemoteBranch[];
  worktrees: WorktreeInfo[];
  repoPath: string;
  currentBranchId: string;
  onSelectBranch: (branch: LocalBranch | RemoteBranch) => void;
  onCheckoutBranch: (branch: LocalBranch | RemoteBranch) => void;
  onCreateBranchFrom?: (refName: string) => void;
  onDeleteBranch?: (refName: string) => void;
  onRequestRenameBranch?: (name: string) => void;
  onWorktreeCreated?: () => void;
  onSelectWorktree?: (worktree: WorktreeInfo) => void;
  onSwitchWorktree?: (worktree: WorktreeInfo) => void;
  onDeleteWorktree?: (worktree: WorktreeInfo) => void;
  onRenameWorktree?: (worktree: WorktreeInfo) => void;
  onOpenInFinder?: (worktree: WorktreeInfo) => void;
  onPruneWorktree?: (worktree: WorktreeInfo) => void;
  onOpenCreateWorktree?: (branchName: string, isRemote: boolean) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onStartResize?: (event: ReactMouseEvent) => void;
}

type SectionKey = "LOCAL" | "REMOTE" | "WORKTREES" | "CLOUD PATCHES" | "PULL REQUESTS" | "ISSUES" | "TEAMS";

export function BranchSidebar({
  localBranches,
  remoteBranches,
  worktrees,
  repoPath,
  currentBranchId,
  onSelectBranch,
  onCheckoutBranch,
  onCreateBranchFrom,
  onDeleteBranch,
  onRequestRenameBranch,
  onWorktreeCreated,
  onSelectWorktree,
  onSwitchWorktree,
  onDeleteWorktree,
  onRenameWorktree,
  onOpenInFinder,
  onPruneWorktree,
  onOpenCreateWorktree,
  collapsed: panelCollapsed = false,
  onToggleCollapsed,
  onStartResize,
}: BranchSidebarProps) {
  if (panelCollapsed) {
    return (
      <aside className="panel-rail" aria-label="Branch sidebar collapsed">
        <button
          type="button"
          title="Expand branch sidebar"
          aria-label="Expand branch sidebar"
          onClick={onToggleCollapsed}
        >
          <IconCaretRight size={14} />
        </button>
      </aside>
    );
  }
  const [collapsed, setCollapsed] = useState<Record<SectionKey, boolean>>({
    LOCAL: false,
    REMOTE: false,
    WORKTREES: false,
    "CLOUD PATCHES": true,
    "PULL REQUESTS": true,
    ISSUES: true,
    TEAMS: true,
  });
  const [folderCollapsed, setFolderCollapsed] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState("");
  const filterInputRef = useRef<HTMLInputElement | null>(null);
  type BranchCtxMenuState = {
    x: number;
    y: number;
    refName: string;
    isCurrent: boolean;
    isRemote: boolean;
  };
  const { menu: branchCtxMenu, open: openBranchCtxMenu, close: closeBranchCtxMenu } =
    useContextMenu<BranchCtxMenuState>();

  const hasLocalTrackingBranch = (remoteBranchName: string): boolean => {
    return localBranches.some((b) => b.name === remoteBranchName);
  };

  const isMac = useMemo(() => navigator.platform.toUpperCase().includes("MAC"), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "f" || event.shiftKey) return;

      const isMacShortcut = isMac && event.metaKey && event.altKey && !event.ctrlKey;
      const isWindowsShortcut = !isMac && event.ctrlKey && event.altKey && !event.metaKey;

      if (!isMacShortcut && !isWindowsShortcut) return;

      event.preventDefault();
      filterInputRef.current?.focus();
      filterInputRef.current?.select();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMac]);

  const toggleSection = (k: SectionKey) =>
    setCollapsed((s) => ({ ...s, [k]: !s[k] }));
  const toggleFolder = (k: string) =>
    setFolderCollapsed((s) => ({ ...s, [k]: !s[k] }));

  const grouped = useMemo(() => {
    const out: { _flat: LocalBranch[]; folders: Record<string, LocalBranch[]> } = {
      _flat: [],
      folders: {},
    };
    for (const b of localBranches) {
      if (b.folder) {
        out.folders[b.folder] = out.folders[b.folder] || [];
        out.folders[b.folder].push(b);
      } else {
        out._flat.push(b);
      }
    }
    return out;
  }, [localBranches]);

  const filterFn = (b: { name: string }) =>
    !filter || b.name.toLowerCase().includes(filter.toLowerCase());

  const totalLocal = localBranches.length;
  const totalLocalRows = totalLocal + Object.keys(grouped.folders).length;
  const totalRemote = remoteBranches.reduce(
    (s, r) => s + 1 + (r.children?.length || 0),
    0
  );

  const localOpen = !collapsed.LOCAL;
  const remoteOpen = !collapsed.REMOTE;
  const bothOpen = localOpen && remoteOpen;
  const localWeight = Math.max(1, totalLocalRows);
  const remoteWeight = Math.max(1, totalRemote);
  const totalWeight = localWeight + remoteWeight;
  const localRatio = bothOpen ? localWeight / totalWeight : 1;
  const remoteRatio = bothOpen ? remoteWeight / totalWeight : 1;
  const localFlexGrow = bothOpen ? Math.min(0.7, Math.max(0.3, localRatio)) : 1;
  const remoteFlexGrow = bothOpen ? Math.min(0.7, Math.max(0.3, remoteRatio)) : 1;
  const localBodyStyle = bothOpen
    ? ({ ["--split-ratio" as string]: String(localFlexGrow) } as CSSProperties)
    : undefined;
  const remoteBodyStyle = bothOpen
    ? ({ ["--split-ratio" as string]: String(remoteFlexGrow) } as CSSProperties)
    : undefined;

  const renderSectionHeader = (
    key: SectionKey,
    icon: React.ReactNode,
    label: string,
    count: number
  ) => (
    <div
      className={"section-header" + (collapsed[key] ? " collapsed" : "")}
      onClick={() => toggleSection(key)}
    >
      <IconCaretDown size={12} className="chevron" />
      <span className="icon">{icon}</span>
      <span className="title">{label}</span>
      <span className={"count" + (count === 0 ? " zero" : "")}>{count}</span>
    </div>
  );

  const renderBranchRow = (b: LocalBranch, opts: { short?: string; indent?: 22 | 40 } = {}) => {
    const isCurrent = b.id === currentBranchId;
    const indentClass = opts.indent === 40 ? "indent-40" : opts.indent === 22 ? "indent-22" : "";
    return (
      <div
        key={b.id}
        className={"branch-row" + (isCurrent ? " current" : "") + (indentClass ? ` ${indentClass}` : "")}
        onClick={() => onSelectBranch(b)}
        onDoubleClick={() => onCheckoutBranch(b)}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          openBranchCtxMenu({
            x: event.clientX,
            y: event.clientY,
            refName: b.name,
            isCurrent,
            isRemote: false,
          });
        }}
        title={b.name}
      >
        {isCurrent ? (
          <IconCheck size={13} className="check" />
        ) : (
          <IconBranch size={13} className="icon" />
        )}
        <span className="name">{opts.short ?? b.name}</span>
        {b.ahead > 0 && (
          <span className="ahead-behind ahead">
            {b.ahead}
            <IconArrowUp size={10} />
          </span>
        )}
        {b.behind > 0 && (
          <span className="ahead-behind behind">
            {b.behind}
            <IconArrowDown size={10} />
          </span>
        )}
      </div>
    );
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-top-bar">
        <div className="filter sidebar-filter-top">
          <input
            ref={filterInputRef}
            placeholder={isMac ? "Filter (⌘ + ⌥ + F)" : "Filter (Ctrl + Alt + F)"}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        {onToggleCollapsed && (
          <button
            type="button"
            className="panel-collapse-btn"
            title="Collapse branch sidebar"
            aria-label="Collapse branch sidebar"
            onClick={onToggleCollapsed}
          >
            <IconCaretLeft size={14} />
          </button>
        )}
      </div>

      <div className={"scroll" + (bothOpen ? " split-open" : "")}>
        <div
          className={"section" + (!collapsed["LOCAL"] ? " expanded" : "")}
        >
          {renderSectionHeader("LOCAL", <IconMonitor size={13} />, "Local", totalLocal)}
          {!collapsed["LOCAL"] && (
            <div className="section-body" style={localBodyStyle}>
              <div className="branch-group">
                {Object.entries(grouped.folders).map(([folder, items]) => {
                  const open = !folderCollapsed[folder];
                  const visible = items.filter(filterFn);
                  if (filter && visible.length === 0) return null;
                  return (
                    <Fragment key={folder}>
                      <div
                        className={"branch-folder" + (open ? "" : " collapsed")}
                        onClick={() => toggleFolder(folder)}
                      >
                        <IconCaretDown size={11} className="chevron" />
                        <IconFolder size={13} className="icon" />
                        <span className="name">{folder}</span>
                      </div>
                      {open &&
                        visible.map((b) =>
                          renderBranchRow(b, {
                            short: b.name.replace(folder + "/", ""),
                            indent: 40,
                          })
                        )}
                    </Fragment>
                  );
                })}
                {grouped._flat.filter(filterFn).map((b) => renderBranchRow(b))}
                {totalLocal === 0 && <div className="empty-row">No branches</div>}
              </div>
              <WorktreeSection
                worktrees={worktrees}
                loading={false}
                error={null}
                onSelectWorktree={onSelectWorktree || (() => {})}
                onSwitchWorktree={onSwitchWorktree || (() => {})}
                onDeleteWorktree={onDeleteWorktree}
                onRenameWorktree={onRenameWorktree}
                onOpenInFinder={onOpenInFinder}
                onPruneWorktree={onPruneWorktree}
                onAddWorktree={() => onOpenCreateWorktree?.("", false)}
                collapsed={collapsed["WORKTREES"]}
                onToggleCollapsed={() => toggleSection("WORKTREES")}
              />
            </div>
          )}
        </div>

        <div
          className={"section" + (!collapsed["REMOTE"] ? " expanded" : "")}
        >
          {renderSectionHeader("REMOTE", <IconCloud size={13} />, "Remote", totalRemote)}
          {!collapsed["REMOTE"] && (
            <div className="section-body" style={remoteBodyStyle}>
              <div className="branch-group">
                {remoteBranches.map((b) => {
                  if (b.isFolder) {
                    const open = !folderCollapsed["r-" + b.id];
                    return (
                      <Fragment key={b.id}>
                        <div
                          className={"branch-folder" + (open ? "" : " collapsed") + " indent-22"}
                          onClick={() => toggleFolder("r-" + b.id)}
                        >
                          <IconCaretDown size={11} className="chevron" />
                          <IconFolder size={13} className="icon" />
                          <span className="name">{b.name}</span>
                        </div>
                        {open &&
                          b.children?.map((c) => (
                            <div
                              key={c.id}
                              className="branch-row indent-40"
                              onClick={() => onSelectBranch(c)}
                              onDoubleClick={() => onCheckoutBranch(c)}
                              onContextMenu={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                openBranchCtxMenu({
                                  x: event.clientX,
                                  y: event.clientY,
                                  refName: c.name,
                                  isCurrent: false,
                                  isRemote: true,
                                });
                              }}
                            >
                              <IconBranch size={13} className="icon" />
                              <span className="name">{c.name}</span>
                            </div>
                          ))}
                      </Fragment>
                    );
                  }
                  return (
                    <div
                      key={b.id}
                      className="branch-row indent-22"
                      onClick={() => onSelectBranch(b)}
                      onDoubleClick={() => onCheckoutBranch(b)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openBranchCtxMenu({
                          x: event.clientX,
                          y: event.clientY,
                          refName: b.name,
                          isCurrent: false,
                          isRemote: true,
                        });
                      }}
                    >
                      <IconBranch size={13} className="icon" />
                      <span className="name">{b.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {branchCtxMenu && (
        <div
          className="ctx-menu"
          style={{ left: branchCtxMenu.x, top: branchCtxMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
          role="menu"
        >
          <button
            type="button"
            className="ctx-menu-item"
            role="menuitem"
            onClick={() => {
              onCreateBranchFrom?.(branchCtxMenu.refName);
              closeBranchCtxMenu();
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
                  closeBranchCtxMenu();
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
                  closeBranchCtxMenu();
                }}
              >
                Delete branch
              </button>
            </>
          )}
          {!branchCtxMenu.isRemote && (
            <button
              type="button"
              className="ctx-menu-item"
              role="menuitem"
              onClick={() => {
                onOpenCreateWorktree?.(branchCtxMenu.refName, false);
                closeBranchCtxMenu();
              }}
            >
              Create Worktree
            </button>
          )}
          {branchCtxMenu.isRemote && hasLocalTrackingBranch(branchCtxMenu.refName) && (
            <button
              type="button"
              className="ctx-menu-item"
              role="menuitem"
              onClick={() => {
                onOpenCreateWorktree?.(branchCtxMenu.refName, true);
                closeBranchCtxMenu();
              }}
            >
              Create Worktree
            </button>
          )}
        </div>
      )}
      {onStartResize && (
        <div
          className="panel-resize-handle panel-resize-handle-right"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize branch sidebar"
          onMouseDown={onStartResize}
        />
      )}
    </aside>
  );
}
