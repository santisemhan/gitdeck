import { useEffect, useMemo, useState } from "react";
import { GitBranch, GitCommit, GitFileChange, GitStatus, Repository } from "../../shared/types";

type Filter = "all" | "staged" | "unstaged" | "untracked" | "conflicted";
type NoticeKind = "info" | "success" | "warning" | "error";

export function App() {
  if (!window.gitdeck) {
    return (
      <div style={{ padding: 20, color: "#fecaca", fontFamily: "Segoe UI, sans-serif" }}>
        GitDeck preload bridge is unavailable. Restart the app. If this persists, run a fresh build.
      </div>
    );
  }

  const [recentRepos, setRecentRepos] = useState<Repository[]>([]);
  const [repoPath, setRepoPath] = useState("");
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [history, setHistory] = useState<GitCommit[]>([]);
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [selectedFile, setSelectedFile] = useState<GitFileChange | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null);
  const [diffText, setDiffText] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [commitMessage, setCommitMessage] = useState("");
  const [manualCherryPick, setManualCherryPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState<NoticeKind>("info");
  const [selectedDiffStaged, setSelectedDiffStaged] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<null | (() => Promise<void>)>(null);

  const setNoticeWithKind = (message: string, kind: NoticeKind) => {
    setNotice(message);
    setNoticeKind(kind);
  };

  const closeConfirm = () => {
    setShowConfirm(false);
    setConfirmTitle("");
    setConfirmMessage("");
    setConfirmAction(null);
  };

  const askConfirm = (title: string, message: string, action: () => Promise<void>) => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setShowConfirm(true);
  };

  const classifyError = (message: string): { kind: NoticeKind; text: string } => {
    const m = message.toLowerCase();
    if (m.includes("no upstream")) return { kind: "warning", text: "No upstream configured for this branch." };
    if (m.includes("authentication") || m.includes("permission denied")) return { kind: "error", text: "Authentication failed. Check your Git credentials." };
    if (m.includes("rejected")) return { kind: "warning", text: "Push rejected. Pull/rebase and try again." };
    if (m.includes("network") || m.includes("resolve host") || m.includes("unable to access")) return { kind: "error", text: "Network error while contacting remote." };
    if (m.includes("conflict")) return { kind: "warning", text: "Git reported conflicts. Resolve them and continue." };
    return { kind: "error", text: message || "Operation failed" };
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
      setNoticeWithKind((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    window.gitdeck.getRecentRepositories().then(setRecentRepos).catch(() => undefined);
  }, []);

  const openRepo = async () => {
    const res = await window.gitdeck.selectRepository();
    if (!res?.ok) {
      setNoticeWithKind(res?.message || "Unable to open repository", "error");
      return;
    }
    setRepoPath(res.path);
    await refresh(res.path);
  };

  const runAndRefresh = async (fn: () => Promise<{ ok: boolean; message?: string; stderr: string }>) => {
    setBusy(true);
    const result = await fn();
    if (result.ok) setNoticeWithKind("Done", "success");
    else {
      const classified = classifyError(result.message || result.stderr || "Operation failed");
      setNoticeWithKind(classified.text, classified.kind);
    }
    await refresh();
    setBusy(false);
  };

  const handleCheckoutBranch = async (branchName: string) => {
    if (!repoPath || !branchName) return;
    const dirty = !!status && !status.clean;
    if (!dirty) {
      await runAndRefresh(() => window.gitdeck.checkoutBranch(repoPath, branchName));
      return;
    }
    askConfirm(
      "Checkout with dirty tree",
      `Your working tree has uncommitted changes. Checkout to '${branchName}' may fail or cause conflicts. Continue anyway?`,
      async () => {
        closeConfirm();
        await runAndRefresh(() => window.gitdeck.checkoutBranch(repoPath, branchName));
      }
    );
  };

  const handleAbortCherryPick = async () => {
    askConfirm(
      "Abort cherry-pick",
      "This will stop the current cherry-pick sequence and discard its in-progress state. Continue?",
      async () => {
        closeConfirm();
        await runAndRefresh(() => window.gitdeck.abortCherryPick(repoPath));
      }
    );
  };

  const createBranchFromModal = async () => {
    const name = newBranchName.trim();
    if (!name) {
      setNoticeWithKind("Branch name cannot be empty.", "warning");
      return;
    }
    await runAndRefresh(() => window.gitdeck.createBranch(repoPath, name));
    setNewBranchName("");
    setShowBranchModal(false);
  };

  const filteredChanges = useMemo(() => {
    const list = status?.changes ?? [];
    if (filter === "all") return list;
    if (filter === "staged") return list.filter((c) => c.staged);
    if (filter === "unstaged") return list.filter((c) => c.unstaged && !c.untracked);
    if (filter === "untracked") return list.filter((c) => c.untracked);
    return list.filter((c) => c.conflicted);
  }, [status, filter]);

  const selectFile = async (file: GitFileChange, staged: boolean) => {
    setSelectedCommit(null);
    setSelectedFile(file);
    setSelectedDiffStaged(staged);
    const diff = await window.gitdeck.getDiff(repoPath, file.path, staged);
    if (diff.isBinary) setDiffText("Binary file. Diff is not displayed.");
    else if (diff.tooLarge) setDiffText("Large diff truncated. Open in VS Code for full view.\n\n" + (diff.text || ""));
    else setDiffText(diff.text || "No textual diff available.");
  };

  const selectCommit = async (commit: GitCommit) => {
    setSelectedFile(null);
    setSelectedCommit(commit);
    const details = await window.gitdeck.getCommitDetails(repoPath, commit.hash);
    setDiffText(details.patch || "No diff");
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <h2>GitDeck</h2>
        <button onClick={openRepo}>Open Repository</button>
        <div className="block">
          <h3>Recent</h3>
          {recentRepos.map((r) => (
            <button key={r.path} className="repo-btn" onClick={() => { setRepoPath(r.path); refresh(r.path); }}>
              {r.name}
            </button>
          ))}
        </div>
        <div className="block">
          <h3>Branches</h3>
          {branches.map((b) => (
            <button key={`${b.remote}:${b.name}`} className={b.current ? "current" : "repo-btn"} onClick={() => !b.remote && handleCheckoutBranch(b.name)}>
              {b.remote ? `remote/${b.name}` : b.name}
            </button>
          ))}
        </div>
      </aside>

      <main className="main">
        <header className="toolbar">
          <span>{repoPath || "No repository opened"}</span>
          <div className="toolbar-actions">
            <button disabled={!repoPath || busy} onClick={() => refresh()}>Refresh</button>
            <button disabled={!repoPath || busy} onClick={() => runAndRefresh(() => window.gitdeck.pull(repoPath))}>Pull</button>
            <button disabled={!repoPath || busy} onClick={() => runAndRefresh(() => window.gitdeck.push(repoPath))}>Push</button>
            <button disabled={!repoPath || busy} onClick={() => setShowBranchModal(true)}>New Branch</button>
          </div>
        </header>

        <section className="overview">
          <div><span className="badge">Branch</span> {status?.branch ?? "-"}</div>
          <div><span className="badge">Upstream</span> {status?.upstream ?? "none"}</div>
          <div><span className="badge">Ahead/Behind</span> {status ? `${status.ahead}/${status.behind}` : "-"}</div>
          <div><span className="badge">State</span> {status?.state.operationState ?? "-"}</div>
          <div><span className={`badge ${status?.clean ? "good" : "warn"}`}>Tree</span> {status?.clean ? "clean" : "dirty"}</div>
          {!!status?.conflicts.hasConflicts && <div><span className="badge warn">Conflicts</span> {status.conflicts.files.length}</div>}
        </section>

        <section className="content-grid">
          <div className="panel">
            <h3>Changed Files</h3>
            <div className="row">
              <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
                <option value="all">all</option><option value="staged">staged</option><option value="unstaged">unstaged</option><option value="untracked">untracked</option><option value="conflicted">conflicted</option>
              </select>
              <button onClick={() => runAndRefresh(() => window.gitdeck.stageAll(repoPath))}>Stage All</button>
              <button onClick={() => runAndRefresh(() => window.gitdeck.unstageAll(repoPath))}>Unstage All</button>
            </div>
            <ul>
              {filteredChanges.map((f) => (
                <li key={`${f.path}:${f.kind}`}>
                  <button onClick={() => selectFile(f, f.staged && !f.unstaged)}>{f.kind} {f.path}</button>
                  {f.staged && f.unstaged && (
                    <>
                      <button onClick={() => selectFile(f, false)}>Diff unstaged</button>
                      <button onClick={() => selectFile(f, true)}>Diff staged</button>
                    </>
                  )}
                  <button onClick={() => runAndRefresh(() => f.staged ? window.gitdeck.unstageFile(repoPath, f.path) : window.gitdeck.stageFile(repoPath, f.path))}>{f.staged ? "Unstage" : "Stage"}</button>
                  {f.conflicted && <button onClick={() => window.gitdeck.openFileInVSCode(`${repoPath}/${f.path}`)}>Open in VS Code</button>}
                </li>
              ))}
            </ul>
          </div>

          <div className="panel">
            <h3>History</h3>
            <ul>
              {history.map((c) => (
                <li key={c.hash}>
                  <button onClick={() => selectCommit(c)}>{c.shortHash} {c.subject}</button>
                  <button onClick={() => runAndRefresh(() => window.gitdeck.cherryPick(repoPath, c.hash))}>Cherry-pick</button>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel diff">
            <h3>Diff</h3>
            {selectedFile && <div className="muted">File: {selectedFile.path} ({selectedDiffStaged ? "staged" : "unstaged"})</div>}
            {selectedCommit && <div className="muted">Commit: {selectedCommit.shortHash}</div>}
            <pre>{diffText || "Select file or commit"}</pre>
          </div>
        </section>

        <section className="bottom-row">
          <div className="panel">
            <h3>Commit</h3>
            <textarea value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} placeholder="Commit message" />
            <button disabled={!repoPath || busy} onClick={async () => {
              await runAndRefresh(() => window.gitdeck.commit(repoPath, commitMessage));
              setCommitMessage("");
            }}>Commit Staged</button>
          </div>

          <div className="panel">
            <h3>Cherry-pick Workflow</h3>
            <input value={manualCherryPick} onChange={(e) => setManualCherryPick(e.target.value)} placeholder="Commit hash" />
            <div className="row">
              <button onClick={() => runAndRefresh(() => window.gitdeck.cherryPick(repoPath, manualCherryPick))}>Cherry-pick Hash</button>
              <button onClick={() => runAndRefresh(() => window.gitdeck.continueCherryPick(repoPath))}>Continue</button>
              <button className="danger" onClick={handleAbortCherryPick}>Abort</button>
              <button onClick={() => window.gitdeck.openRepositoryInVSCode(repoPath)}>Open Repo in VS Code</button>
            </div>
          </div>
        </section>

        <footer className={`status ${noticeKind}`}>{busy ? "Working..." : notice}</footer>
      </main>

      {showBranchModal && (
        <div className="modal-backdrop" onClick={() => setShowBranchModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create branch</h3>
            <input
              autoFocus
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder="feature/my-branch"
            />
            <div className="row">
              <button onClick={createBranchFromModal}>Create</button>
              <button onClick={() => { setShowBranchModal(false); setNewBranchName(""); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showConfirm && (
        <div className="modal-backdrop" onClick={closeConfirm}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{confirmTitle}</h3>
            <p className="muted">{confirmMessage}</p>
            <div className="row">
              <button className="danger" onClick={() => confirmAction?.()}>Confirm</button>
              <button onClick={closeConfirm}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
