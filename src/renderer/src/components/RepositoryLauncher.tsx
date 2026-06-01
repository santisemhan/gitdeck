import { useEffect, useMemo, useState } from "react";
import type { Repository } from "../../../shared/types";
import type { ActiveRepo } from "../hooks/useActiveRepo";
import type { LauncherMode } from "../data/types";
import {
  IconBranch,
  IconCloudArrowDown,
  IconFolder,
  IconPlus,
  IconSearch
} from "./icons";
import { RepoTabBar } from "./RepoTabBar";
import { formatRelativeTime } from "../utils/date";

interface RepositoryLauncherProps {
  recents: Repository[];
  openRepos: ActiveRepo[];
  activePath: string | null;
  onOpenPicker: () => void;
  onOpenRepo: (repo: Repository) => void;
  onSwitchRepo: (path: string) => void;
  onCloseRepo: (path: string) => void;
  onCloseHome: () => void;
  onReorderRepo: (sourcePath: string, targetPath: string, placeAfter?: boolean) => void;
  onClone: (url: string, parentDir: string) => Promise<boolean>;
  onCreate: (targetPath: string) => Promise<boolean>;
  onChooseDirectory: () => Promise<string | null>;
}

export function RepositoryLauncher({
  recents,
  openRepos,
  activePath,
  onOpenPicker,
  onOpenRepo,
  onSwitchRepo,
  onCloseRepo,
  onCloseHome,
  onReorderRepo,
  onClone,
  onCreate,
  onChooseDirectory
}: RepositoryLauncherProps) {
  const sorted = useMemo(
    () => [...recents].sort((a, b) => (a.lastOpenedAt < b.lastOpenedAt ? 1 : -1)),
    [recents]
  );

  const [mode, setMode] = useState<LauncherMode>("idle");
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [folder, setFolder] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resetForm = () => {
    setMode("idle");
    setUrl("");
    setName("");
    setFolder(null);
    setBusy(false);
  };

  useEffect(() => {
    if (mode === "idle") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) resetForm();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, busy]);

  const handleChooseFolder = async () => {
    const picked = await onChooseDirectory();
    if (picked) setFolder(picked);
  };

  const handleSubmitClone = async () => {
    if (!url.trim() || !folder || busy) return;
    setBusy(true);
    const ok = await onClone(url.trim(), folder);
    if (ok) resetForm();
    else setBusy(false);
  };

  const handleSubmitCreate = async () => {
    if (!folder || busy) return;
    const trimmedName = name.trim();
    const targetPath = trimmedName ? `${folder}/${trimmedName}` : folder;
    setBusy(true);
    const ok = await onCreate(targetPath);
    if (ok) resetForm();
    else setBusy(false);
  };

  return (
    <div className="launcher">
      <RepoTabBar
        openRepos={openRepos}
        activePath={activePath}
        onGoHome={() => {}}
        onCloseHome={onCloseHome}
        onSwitchRepo={onSwitchRepo}
        onCloseRepo={onCloseRepo}
        onReorderRepo={onReorderRepo}
      />

      <div className="launcher-body">
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
              <p>Open, clone or create a Git repository.</p>
            </div>
          </header>

          <div className="launcher-actions">
            <button className="primary" onClick={onOpenPicker}>
              <IconFolder size={15} /> Open
            </button>
            <button className="ghost" onClick={() => { resetForm(); setMode("clone"); }}>
              <IconCloudArrowDown size={15} /> Clone
            </button>
            <button className="ghost" onClick={() => { resetForm(); setMode("create"); }}>
              <IconPlus size={15} /> New
            </button>
          </div>

          {mode === "clone" && (
            <form
              className="launcher-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmitClone();
              }}
            >
              <label className="launcher-field">
                <span>Repository URL</span>
                <input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://github.com/user/repo.git"
                  autoFocus
                  disabled={busy}
                />
              </label>
              <div className="launcher-field">
                <span>Destination folder</span>
                <div className="launcher-folder">
                  <button type="button" className="folder-btn" onClick={() => void handleChooseFolder()} disabled={busy}>
                    <IconFolder size={14} /> Choose folder…
                  </button>
                  <span className="folder-path" title={folder ?? ""}>{folder ?? "No folder selected"}</span>
                </div>
              </div>
              <div className="launcher-form-actions">
                <button type="submit" className="primary" disabled={!url.trim() || !folder || busy}>
                  {busy ? "Cloning…" : "Clone"}
                </button>
                <button type="button" className="ghost" onClick={resetForm} disabled={busy}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {mode === "create" && (
            <form
              className="launcher-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmitCreate();
              }}
            >
              <label className="launcher-field">
                <span>Repository name <em>(optional)</em></span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="my-project"
                  autoFocus
                  disabled={busy}
                />
              </label>
              <div className="launcher-field">
                <span>Location</span>
                <div className="launcher-folder">
                  <button type="button" className="folder-btn" onClick={() => void handleChooseFolder()} disabled={busy}>
                    <IconFolder size={14} /> Choose folder…
                  </button>
                  <span className="folder-path" title={folder ?? ""}>{folder ?? "No folder selected"}</span>
                </div>
              </div>
              <div className="launcher-form-actions">
                <button type="submit" className="primary" disabled={!folder || busy}>
                  {busy ? "Creating…" : "Create"}
                </button>
                <button type="button" className="ghost" onClick={resetForm} disabled={busy}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          <section className="launcher-recents">
            <div className="launcher-recents-head">
              <span className="title">Recent</span>
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
                {sorted.map((r) => {
                  const isOpen = openRepos.some((o) => o.path === r.path);
                  return (
                    <li key={r.path}>
                      <button className="row" onClick={() => onOpenRepo(r)} title={r.path}>
                        <span className="ico">
                          <IconBranch size={14} />
                        </span>
                        <span className="info">
                          <span className="name">
                            {r.name}
                            {isOpen && <span className="open-badge">open</span>}
                          </span>
                          <span className="path">{r.path}</span>
                        </span>
                        <span className="time">{formatRelativeTime(r.lastOpenedAt, { invalid: "" })}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
