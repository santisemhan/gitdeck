import { useMemo } from "react";
import type { Repository } from "../../../shared/types";
import {
  IconBranch,
  IconCloudArrowDown,
  IconFolder,
  IconPlus,
  IconSearch
} from "./icons";

interface RepositoryLauncherProps {
  recents: Repository[];
  onOpenPicker: () => void;
  onOpenRepo: (repo: Repository) => void;
}

function relativeTime(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(mo / 12);
  return `${y}y ago`;
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
                    <span className="time">{relativeTime(r.lastOpenedAt)}</span>
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
