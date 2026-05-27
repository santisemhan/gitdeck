import { useMemo } from "react";
import type { Repository } from "../../../shared/types";
import {
  IconBranch,
  IconCloudArrowDown,
  IconFolder,
  IconPlus,
  IconSearch
} from "./icons";
import { formatRelativeTime } from "../utils/date";

interface RepositoryLauncherProps {
  recents: Repository[];
  onOpenPicker: () => void;
  onOpenRepo: (repo: Repository) => void;
}

export function RepositoryLauncher({ recents, onOpenPicker, onOpenRepo }: RepositoryLauncherProps) {
  const sorted = useMemo(
    () => [...recents].sort((a, b) => (a.lastOpenedAt < b.lastOpenedAt ? 1 : -1)),
    [recents]
  );

  return (
    <div className="launcher">
      <div className="launcher-window">
        <header className="launcher-header">
          <span className="brand-mark">
            <svg width="28" height="28" viewBox="0 0 18 18" fill="none">
              <path d="M5 9L9 3L13 9L9 15Z" fill="var(--accent)" opacity="0.9" />
              <path d="M7 9L9 5L11 9L9 13Z" fill="var(--bg-1)" />
            </svg>
          </span>
          <div>
            <h1>GitDeck</h1>
            <p>Open a Git repository to start.</p>
          </div>
        </header>

        <div className="launcher-actions">
          <button className="primary" onClick={onOpenPicker}>
            <IconFolder size={14} /> Open repository…
          </button>
          <button className="ghost" disabled title="Clone not implemented yet">
            <IconCloudArrowDown size={14} /> Clone…
          </button>
          <button className="ghost" disabled title="Init not implemented yet">
            <IconPlus size={14} /> New repository
          </button>
        </div>

        <section className="launcher-recents">
          <div className="launcher-recents-head">
            <span className="title">Recent repositories</span>
            <span className="count">{sorted.length}</span>
          </div>
          {sorted.length === 0 ? (
            <div className="launcher-empty">
              <IconSearch size={18} />
              <p>No recent repositories.</p>
              <span>Open one to get started.</span>
            </div>
          ) : (
            <ul>
              {sorted.map((r) => (
                <li key={r.path}>
                  <button className="row" onClick={() => onOpenRepo(r)} title={r.path}>
                    <span className="ico">
                      <IconBranch size={14} />
                    </span>
                    <span className="info">
                      <span className="name">{r.name}</span>
                      <span className="path">{r.path}</span>
                    </span>
                    <span className="time">{formatRelativeTime(r.lastOpenedAt, { invalid: "" })}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
