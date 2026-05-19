import { useEffect, useMemo, useState } from "react";
import { CommitDetails, GitBranch, GitCommit, GitFileChange, GitStatus, Repository } from "../../shared/types";
import { DiffViewer } from "./components/DiffViewer";
import { TopToolbar } from "./components/TopToolbar";
import { countStaged, countUnstaged, fileKindClass, fileKindSymbol, shortPath } from "./utils/gitFormat";

type DiffMode = "split" | "inline";
type MainView = "graph" | "filePreview";
type RightPanelMode = "localChanges" | "commitDetails";
type SelectedFileSource = "commit" | "unstaged" | "staged";

function FileStatusIcon({ file }: { file: GitFileChange }) {
  return <span className={`status-mark ${fileKindClass(file.kind)}`}>{fileKindSymbol(file.kind)}</span>;
}

export function App() {
  const [recentRepos, setRecentRepos] = useState<Repository[]>([]);
  const [repoPath, setRepoPath] = useState("");
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [history, setHistory] = useState<GitCommit[]>([]);
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null);
  const [commitDetails, setCommitDetails] = useState<CommitDetails | null>(null);
  const [selectedFile, setSelectedFile] = useState<GitFileChange | null>(null);
  const [selectedFileSource, setSelectedFileSource] = useState<SelectedFileSource | null>(null);
  const [mainView, setMainView] = useState<MainView>("graph");
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>("localChanges");
  const [diffText, setDiffText] = useState("");
  const [diffMode, setDiffMode] = useState<DiffMode>("split");
  const [commitMessage, setCommitMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [toast, setToast] = useState("");
  const [branchSelection, setBranchSelection] = useState<string>("");

  const localBranches = useMemo(() => branches.filter((b) => !b.remote), [branches]);
  const remoteBranches = useMemo(() => branches.filter((b) => b.remote), [branches]);
  const unstagedFiles = useMemo(() => (status?.changes ?? []).filter((f) => f.unstaged || f.untracked), [status]);
  const stagedFiles = useMemo(() => (status?.changes ?? []).filter((f) => f.staged), [status]);
  const stagedCount = useMemo(() => countStaged(status?.changes ?? []), [status]);
  const unstagedCount = useMemo(() => countUnstaged(status?.changes ?? []), [status]);

  const runAndRefresh = async (
    fn: () => Promise<{ ok: boolean; message?: string; stderr: string }>,
    successToast?: string
  ) => {
    setBusy(true);
    const res = await fn();
    setNotice(res.ok ? "Done" : res.message || res.stderr || "Operation failed");
    if (res.ok && successToast) {
      setToast(successToast);
      window.setTimeout(() => setToast(""), 2600);
    }
    await refresh();
    setBusy(false);
  };

  const refresh = async (pathArg = repoPath) => {
    if (!pathArg) return;
    setBusy(true);
    try {
      const [s, h, b, repos] = await Promise.all([
        window.gitdeck.getStatus(pathArg),
        window.gitdeck.getHistory(pathArg),
        window.gitdeck.getBranches(pathArg),
        window.gitdeck.getRecentRepositories()
      ]);
      setStatus(s);
      setHistory(h);
      setBranches(b);
      setRecentRepos(repos);
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    window.gitdeck.getRecentRepositories().then(setRecentRepos).catch(() => undefined);
  }, []);

  const resetToLocalChanges = () => {
    setSelectedCommit(null);
    setCommitDetails(null);
    setSelectedFile(null);
    setSelectedFileSource(null);
    setDiffText("");
    setMainView("graph");
    setRightPanelMode("localChanges");
  };

  const openRepo = async () => {
    const res = await window.gitdeck.selectRepository();
    if (!res?.ok) {
      setNotice(res?.message || "Unable to open repository");
      return;
    }
    setRepoPath(res.path);
    resetToLocalChanges();
    await refresh(res.path);
  };

  const openRecentRepo = async (path: string) => {
    setRepoPath(path);
    resetToLocalChanges();
    await refresh(path);
  };

  const selectCommit = async (commit: GitCommit) => {
    setSelectedCommit(commit);
    setRightPanelMode("commitDetails");
    setMainView("graph");
    setSelectedFile(null);
    setSelectedFileSource(null);
    setDiffText("");
    const details = await window.gitdeck.getCommitDetails(repoPath, commit.hash);
    setCommitDetails(details);
  };

  const selectCommitFile = (file: GitFileChange) => {
    if (!commitDetails) return;
    setSelectedFile(file);
    setSelectedFileSource("commit");
    setDiffText(commitDetails.patch || "No textual diff available");
    setMainView("filePreview");
    setRightPanelMode("commitDetails");
  };

  const selectLocalFile = async (file: GitFileChange, source: "unstaged" | "staged") => {
    setSelectedFile(file);
    setSelectedFileSource(source);
    setRightPanelMode("localChanges");
    const diff = await window.gitdeck.getDiff(repoPath, file.path, source === "staged");
    setDiffText(diff.text || "No textual diff available");
    setMainView("filePreview");
  };

  const closePreview = () => {
    setSelectedFile(null);
    setSelectedFileSource(null);
    setMainView("graph");
  };

  const goToWorkingDirectory = () => {
    setRightPanelMode("localChanges");
    setSelectedFile(null);
    setSelectedFileSource(null);
    setDiffText("");
    setMainView("graph");
  };

  const onRemoteBranchDoubleClick = async (remoteName: string) => {
    setBusy(true);
    const res = await window.gitdeck.checkoutRemoteBranch(repoPath, remoteName);
    setNotice(res.ok ? `Checked out ${remoteName}` : res.message || res.stderr || "Checkout failed");
    await refresh();
    setBusy(false);
  };

  const onCommit = async () => {
    const message = commitMessage.trim();
    if (!message) {
      setNotice("Commit message is required");
      return;
    }
    await runAndRefresh(() => window.gitdeck.commit(repoPath, message));
    setCommitMessage("");
  };

  const onOpenInEditor = async () => {
    if (!selectedFile) return;
    const filePath = `${repoPath}/${selectedFile.path}`;
    const res = await window.gitdeck.openFileInVSCode(filePath);
    setNotice(res.ok ? "Opened file in VS Code" : res.message);
  };

  if (!repoPath) {
    return (
      <div className="launcher-screen">
        <div className="launcher-card">
          <h1>GitDeck</h1>
          <p>Repository Launcher</p>
          <div className="launcher-actions">
            <button onClick={openRepo}>Open Repository</button>
            <button onClick={() => window.gitdeck.getRecentRepositories().then(setRecentRepos)}>Refresh Recent</button>
          </div>
          <div className="launcher-list">
            {recentRepos.map((repo) => (
              <button key={repo.path} className="launcher-item" onClick={() => openRecentRepo(repo.path)}>
                <strong>{repo.name}</strong>
                <span>{repo.path}</span>
              </button>
            ))}
            {recentRepos.length === 0 && <div className="empty">No recent repositories</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TopToolbar
        repoPath={repoPath}
        busy={busy}
        onOpenRepo={() => setRepoPath("")}
        onRefresh={() => refresh()}
        onPull={() => runAndRefresh(() => window.gitdeck.pull(repoPath), "Pull completed successfully")}
        onPush={() => runAndRefresh(() => window.gitdeck.push(repoPath), "Push completed successfully")}
        onBranch={() => undefined}
      />

      <section className={`main-layout ${mainView === "filePreview" ? "file-preview-layout" : ""}`}>
        {mainView === "graph" && (
          <aside className="branch-sidebar">
            <div className="section-header">Local Branches</div>
            {localBranches.map((b) => (
              <button
                key={`local:${b.name}`}
                className={`branch-item ${b.current ? "current" : ""} ${branchSelection === b.name ? "selected" : ""}`}
                onClick={() => setBranchSelection(b.name)}
                onDoubleClick={() => runAndRefresh(() => window.gitdeck.checkoutBranch(repoPath, b.name))}
              >
                <span>{b.name}</span>
              </button>
            ))}
            <div className="section-header">Remote Branches</div>
            {remoteBranches.map((b) => (
              <button
                key={`remote:${b.name}`}
                className={`branch-item muted-item ${branchSelection === b.name ? "selected" : ""}`}
                onClick={() => setBranchSelection(b.name)}
                onDoubleClick={() => onRemoteBranchDoubleClick(b.name)}
                title="Double click to checkout tracking branch"
              >
                <span>{b.name}</span>
              </button>
            ))}
          </aside>
        )}

        <section className="center-pane">
          {mainView === "graph" && (
            <>
              <div className="section-header">Commit Graph</div>
              <ul className="commit-list">
                {history.map((c) => (
                  <li key={c.hash} className={selectedCommit?.hash === c.hash ? "commit-row selected" : "commit-row"}>
                    <div className="graph-col"><span className="commit-node" /></div>
                    <button className="commit-content" onClick={() => selectCommit(c)}>
                      <span className="subject">{c.subject}</span>
                      <span className="meta">{c.shortHash} {c.authorName} {new Date(c.date).toLocaleString()}</span>
                      {!!c.refs && <span className="refs">{c.refs}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {mainView === "filePreview" && selectedFile && (
            <>
              <div className="diff-preview-header">
                <div className="diff-preview-title">
                  <FileStatusIcon file={selectedFile} />
                  <span>{selectedFile.path}</span>
                  <span className="encoding-pill">UTF-8</span>
                </div>
                <div className="diff-actions">
                  <button className={diffMode === "split" ? "active" : ""} onClick={() => setDiffMode("split")}>Split View</button>
                  <button className={diffMode === "inline" ? "active" : ""} onClick={() => setDiffMode("inline")}>Inline View</button>
                  {selectedFileSource === "unstaged" && <button onClick={() => runAndRefresh(() => window.gitdeck.stageFile(repoPath, selectedFile.path))}>Stage File</button>}
                  {selectedFileSource === "staged" && <button onClick={() => runAndRefresh(() => window.gitdeck.unstageFile(repoPath, selectedFile.path))}>Unstage File</button>}
                  {(selectedFileSource === "unstaged" || selectedFileSource === "staged") && <button onClick={onOpenInEditor}>Edit This File</button>}
                  <button onClick={closePreview}>X</button>
                </div>
              </div>
              <DiffViewer
                text={diffText}
                mode={diffMode}
                selectedPath={selectedFileSource === "commit" ? selectedFile.path : undefined}
                emptyText="Select a file to preview its diff"
              />
            </>
          )}
        </section>

        <section className="right-panel">
          {rightPanelMode === "localChanges" && (
            <>
              <div className="detail-header">
                <h2>{status?.changes.length ?? 0} file changes in working directory</h2>
                <div className="meta-row"><span className="branch-pill">{status?.branch ?? "-"}</span></div>
                <div className="meta-row">Unstaged {unstagedCount} • Staged {stagedCount}</div>
                <div className="panel-actions">
                  <button
                    onClick={() => {
                      const first = unstagedFiles[0] ?? stagedFiles[0];
                      if (!first) return;
                      void selectLocalFile(first, first.staged ? "staged" : "unstaged");
                    }}
                  >
                    View Changes
                  </button>
                  <button onClick={() => runAndRefresh(() => window.gitdeck.stageAll(repoPath))}>Stage All Changes</button>
                </div>
              </div>
              <div className="changes-panel">
                <h4>Unstaged Files</h4>
                {unstagedFiles.map((f) => (
                  <div key={`u:${f.path}`} className="file-row">
                    <button className={`file-main ${selectedFile?.path === f.path && selectedFileSource === "unstaged" ? "selected" : ""}`} onClick={() => selectLocalFile(f, "unstaged")}>
                      <FileStatusIcon file={f} />
                      <span>{shortPath(f.path)}</span>
                    </button>
                    <button onClick={() => runAndRefresh(() => window.gitdeck.stageFile(repoPath, f.path))}>Stage</button>
                  </div>
                ))}
                <h4>Staged Files</h4>
                {stagedFiles.map((f) => (
                  <div key={`s:${f.path}`} className="file-row">
                    <button className={`file-main ${selectedFile?.path === f.path && selectedFileSource === "staged" ? "selected" : ""}`} onClick={() => selectLocalFile(f, "staged")}>
                      <FileStatusIcon file={f} />
                      <span>{shortPath(f.path)}</span>
                    </button>
                    <button onClick={() => runAndRefresh(() => window.gitdeck.unstageFile(repoPath, f.path))}>Unstage</button>
                  </div>
                ))}
              </div>
              <div className="commit-form">
                <h4>Commit</h4>
                <textarea
                  value={commitMessage}
                  onChange={(event) => setCommitMessage(event.target.value)}
                  placeholder="Commit message"
                  rows={3}
                />
                <div className="panel-actions">
                  <button onClick={onCommit}>Commit Staged Changes</button>
                </div>
              </div>
            </>
          )}

          {rightPanelMode === "commitDetails" && selectedCommit && commitDetails && (
            <>
              <div className="working-directory-jump">
                <div>{status?.changes.length ?? 0} file changes in working directory</div>
                <button onClick={goToWorkingDirectory}>View Changes</button>
              </div>
              <div className="detail-header">
                <h2>{selectedCommit.subject}</h2>
                <div className="meta-row">{selectedCommit.shortHash} • {selectedCommit.authorName}</div>
                <div className="meta-row">{new Date(selectedCommit.date).toLocaleString()}</div>
                <div className="meta-row">Parent: {commitDetails.parentHashes.join(", ") || "none"}</div>
                {!!selectedCommit.refs && <div className="meta-row">{selectedCommit.refs}</div>}
                <div className="meta-row">{commitDetails.files.length} files changed in this commit</div>
              </div>
              <div className="changes-panel">
                {commitDetails.files.map((f) => (
                  <button key={f.path} className={`file-main ${selectedFile?.path === f.path && selectedFileSource === "commit" ? "selected" : ""}`} onClick={() => selectCommitFile(f)}>
                    <FileStatusIcon file={f} />
                    <span>{shortPath(f.path)}</span>
                    <span className="line-stat">+{f.additions ?? 0} -{f.deletions ?? 0}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      </section>

      <footer className="status">{busy ? "Working..." : notice}</footer>
      {toast && <div className="success-toast">{toast}</div>}
    </div>
  );
}
