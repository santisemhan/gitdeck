import type {
  GitBranch,
  GitCommit,
  GitFileChange,
  GitFileKind,
  GitStatus
} from "../../../shared/types";
import type {
  ChangedFile,
  Commit,
  CommitRef,
  FileStatus,
  LocalBranch,
  RemoteBranch
} from "../data/types";
import { assignLanes } from "./graphLanes";

function fileKindToStatus(kind: GitFileKind): FileStatus {
  if (kind === "added" || kind === "untracked") return "added";
  if (kind === "deleted") return "deleted";
  if (kind === "renamed" || kind === "copied") return "renamed";
  return "modified";
}

export function toChangedFiles(status: GitStatus): { unstaged: ChangedFile[]; staged: ChangedFile[] } {
  const unstaged: ChangedFile[] = [];
  const staged: ChangedFile[] = [];
  for (const f of status.changes) {
    if (f.staged) {
      staged.push(toChangedFile(f, "staged"));
    }
    if (f.unstaged || f.untracked) {
      unstaged.push(toChangedFile(f, "unstaged"));
    }
  }
  return { unstaged, staged };
}

function toChangedFile(f: GitFileChange, area: "staged" | "unstaged"): ChangedFile {
  return {
    id: `${area}:${f.path}`,
    path: f.path,
    status: fileKindToStatus(f.kind),
    renamedFrom: f.oldPath,
    additions: f.additions ?? 0,
    deletions: f.deletions ?? 0,
    oldText: "",
    newText: ""
  };
}

export function parseRefs(refs: string): CommitRef[] {
  if (!refs) return [];
  const out: CommitRef[] = [];
  for (const part of refs.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (part.startsWith("tag: ")) {
      out.push({ kind: "tag", name: part.slice(5) });
    } else if (part.startsWith("HEAD -> ")) {
      out.push({ kind: "branch", name: part.slice(8), current: true });
    } else if (part === "HEAD") {
      // detached
    } else {
      out.push({ kind: "branch", name: part });
    }
  }
  return out;
}

export function toCommits(
  history: GitCommit[],
  options: { unstagedCount: number; stagedCount: number; currentBranch?: string }
): Commit[] {
  const flat = history.map((h) => ({
    id: h.hash,
    parents: h.parents,
    raw: h
  }));
  const laned = assignLanes(flat);
  const commits: Commit[] = laned.map((c) => {
    const refs = parseRefs(c.raw.refs);
    return {
      id: c.id,
      hash: c.raw.shortHash || c.id.slice(0, 7),
      title: c.raw.subject,
      body: c.raw.body || "",
      author: c.raw.authorName,
      email: c.raw.authorEmail,
      dateISO: c.raw.date,
      parents: c.parents,
      parentsLanes: c.parentsLanes,
      refs,
      lane: c.lane,
      isMerge: c.parents.length > 1
    };
  });

  const total = options.unstagedCount + options.stagedCount;
  if (total > 0 && commits.length > 0) {
    const head = commits[0];
    const wip: Commit = {
      id: "c-wip",
      hash: "WIP",
      title: "// WIP",
      body: "",
      author: "—",
      email: "",
      dateISO: new Date().toISOString(),
      parents: [head.id],
      parentsLanes: [head.lane],
      refs: [],
      lane: head.lane,
      isWip: true,
      additions: total
    };
    return [wip, ...commits];
  }
  return commits;
}

function makeBranchId(name: string): string {
  return "b-" + name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

export function toBranches(
  branches: GitBranch[],
  status: GitStatus | null
): { local: LocalBranch[]; remote: RemoteBranch[]; currentBranchId: string } {
  const local: LocalBranch[] = [];
  const remoteFlat: { name: string; remote: string }[] = [];

  for (const b of branches) {
    if (b.remote) {
      const trimmed = b.name.trim();
      const slash = trimmed.indexOf("/");
      const remoteName = slash >= 0 ? trimmed.slice(0, slash) : "origin";
      const branchName = slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
      remoteFlat.push({ name: branchName, remote: remoteName });
    } else {
      const slash = b.name.indexOf("/");
      const folder = slash >= 0 ? b.name.slice(0, slash) : undefined;
      local.push({
        id: makeBranchId(b.name),
        name: b.name,
        type: "local",
        current: b.current,
        ahead: b.current && status ? status.ahead : 0,
        behind: b.current && status ? status.behind : 0,
        lastActivity: "",
        folder
      });
    }
  }

  const grouped: Record<string, RemoteBranch[]> = {};
  const flatRemotes: RemoteBranch[] = [];
  for (const r of remoteFlat) {
    const slash = r.name.indexOf("/");
    if (slash >= 0) {
      const folder = r.name.slice(0, slash);
      const child: RemoteBranch = {
        id: "r-" + r.remote + "-" + r.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
        name: r.name.slice(slash + 1),
        type: "remote",
        remote: r.remote
      };
      grouped[folder] = grouped[folder] || [];
      grouped[folder].push(child);
    } else {
      flatRemotes.push({
        id: "r-" + r.remote + "-" + r.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
        name: r.name,
        type: "remote",
        remote: r.remote
      });
    }
  }

  const remote: RemoteBranch[] = [];
  for (const [folder, children] of Object.entries(grouped)) {
    remote.push({
      id: "r-folder-" + folder.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
      name: folder,
      type: "remote",
      remote: children[0]?.remote || "origin",
      isFolder: true,
      children
    });
  }
  remote.push(...flatRemotes);

  const currentBranchId =
    local.find((b) => b.current)?.id || (local[0] ? local[0].id : "");

  return { local, remote, currentBranchId };
}

export function commitFileToChangedFile(f: GitFileChange): ChangedFile {
  return {
    id: `commit:${f.path}`,
    path: f.path,
    status: fileKindToStatus(f.kind),
    renamedFrom: f.oldPath,
    additions: f.additions ?? 0,
    deletions: f.deletions ?? 0,
    oldText: "",
    newText: ""
  };
}
