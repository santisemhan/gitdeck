import { Fragment, useMemo, useState } from "react";
import type { LocalBranch, RemoteBranch } from "../data/types";
import {
  IconArrowDown,
  IconArrowUp,
  IconBranch,
  IconCaretDown,
  IconCheck,
  IconCloud,
  IconFolder,
  IconMonitor,
} from "./icons";

interface BranchSidebarProps {
  localBranches: LocalBranch[];
  remoteBranches: RemoteBranch[];
  currentBranchId: string;
  onSelectBranch: (branch: LocalBranch | RemoteBranch) => void;
  onCheckoutBranch: (branch: LocalBranch | RemoteBranch) => void;
}

type SectionKey = "LOCAL" | "REMOTE" | "WORKTREES" | "CLOUD PATCHES" | "PULL REQUESTS" | "ISSUES" | "TEAMS";

export function BranchSidebar({
  localBranches,
  remoteBranches,
  currentBranchId,
  onSelectBranch,
  onCheckoutBranch,
}: BranchSidebarProps) {
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
  const totalRemote = remoteBranches.reduce(
    (s, r) => s + 1 + (r.children?.length || 0),
    0
  );

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

  const renderBranchRow = (b: LocalBranch, opts: { short?: string; indent?: number } = {}) => {
    const isCurrent = b.id === currentBranchId;
    return (
      <div
        key={b.id}
        className={"branch-row" + (isCurrent ? " current" : "")}
        style={opts.indent != null ? { paddingLeft: opts.indent } : undefined}
        onClick={() => onSelectBranch(b)}
        onDoubleClick={() => onCheckoutBranch(b)}
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
            <IconArrowDown size={10} />
          </span>
        )}
        {b.behind > 0 && (
          <span className="ahead-behind behind">
            {b.behind}
            <IconArrowUp size={10} />
          </span>
        )}
      </div>
    );
  };

  return (
    <aside className="sidebar">
      <div className="filter" style={{ marginTop: 8 }}>
        <input
          placeholder="Filter (Ctrl + Alt + f)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="scroll">
        <div className="section">
          {renderSectionHeader("LOCAL", <IconMonitor size={13} />, "Local", totalLocal)}
          {!collapsed["LOCAL"] && (
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
          )}
        </div>

        <div className="section">
          {renderSectionHeader("REMOTE", <IconCloud size={13} />, "Remote", totalRemote)}
          {!collapsed["REMOTE"] && (
            <div className="branch-group">
              {remoteBranches.map((b) => {
                if (b.isFolder) {
                  const open = !folderCollapsed["r-" + b.id];
                  return (
                    <Fragment key={b.id}>
                      <div
                        className={"branch-folder" + (open ? "" : " collapsed")}
                        onClick={() => toggleFolder("r-" + b.id)}
                        style={{ paddingLeft: 22 }}
                      >
                        <IconCaretDown size={11} className="chevron" />
                        <IconFolder size={13} className="icon" />
                        <span className="name">{b.name}</span>
                      </div>
                      {open &&
                        b.children?.map((c) => (
                          <div
                            key={c.id}
                            className="branch-row"
                            style={{ paddingLeft: 40 }}
                            onClick={() => onSelectBranch(c)}
                            onDoubleClick={() => onCheckoutBranch(c)}
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
                    className="branch-row"
                    style={{ paddingLeft: 22 }}
                    onClick={() => onSelectBranch(b)}
                    onDoubleClick={() => onCheckoutBranch(b)}
                  >
                    <IconBranch size={13} className="icon" />
                    <span className="name">{b.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
