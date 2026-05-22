import type {
  GitBranch,
  GitCommit,
  GitFileChange,
  GitFileKind,
  GitStashEntry,
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
    if (/^[^/]+\/HEAD(\s+->\s+.+)?$/.test(part)) {
      continue;
    }
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

  const normalized = out.map((ref) => {
    if (ref.kind !== "branch" || !ref.name) return ref;
    const name = ref.name.startsWith("origin/") ? ref.name.slice("origin/".length) : ref.name;
    return { ...ref, name };
  });

  const deduped: CommitRef[] = [];
  for (const ref of normalized) {
    const key = `${ref.kind}:${ref.name ?? ""}`;
    const existingIndex = deduped.findIndex((item) => `${item.kind}:${item.name ?? ""}` === key);
    if (existingIndex === -1) {
      deduped.push(ref);
      continue;
    }
    if (ref.current && !deduped[existingIndex].current) {
      deduped[existingIndex] = ref;
    }
  }
  return deduped;
}

interface StashSynthetic {
  isStashSynthetic: true;
  stashIndex: number;
  stashMessage: string;
  stashBranch: string;
  stashDate: string;
  hash: string;
}

export function toCommits(
  history: GitCommit[],
  options: {
    unstagedCount: number;
    stagedCount: number;
    currentBranch?: string;
    stashes?: GitStashEntry[];
  }
): Commit[] {
  type FlatEntry = {
    id: string;
    parents: string[];
    raw: GitCommit | null;
    stash: StashSynthetic | null;
  };

  const flat: FlatEntry[] = history.map((h) => ({
    id: h.hash,
    parents: h.parents,
    raw: h,
    stash: null
  }));

  const stashes = options.stashes || [];
  if (stashes.length > 0) {
    const indexById = new Map<string, number>();
    flat.forEach((entry, idx) => indexById.set(entry.id, idx));

    const sortedStashes = [...stashes].sort((a, b) => a.index - b.index);
    for (const stash of sortedStashes) {
      const parentIdx = indexById.get(stash.parentHash);
      if (parentIdx === undefined) {
        console.warn(`Stash ${stash.hash} parent ${stash.parentHash} not in history; skipping`);
        continue;
      }
      const entry: FlatEntry = {
        id: stash.hash,
        parents: [stash.parentHash],
        raw: null,
        stash: {
          isStashSynthetic: true,
          stashIndex: stash.index,
          stashMessage: stash.message,
          stashBranch: stash.branch,
          stashDate: stash.dateISO,
          hash: stash.hash
        }
      };
      flat.splice(parentIdx, 0, entry);
      indexById.clear();
      flat.forEach((e, idx) => indexById.set(e.id, idx));
    }
  }

  const laned = assignLanes(flat);
  const commits: Commit[] = laned.map((c) => {
    if (c.stash) {
      return {
        id: c.id,
        hash: c.stash.hash.slice(0, 7),
        title: c.stash.stashMessage || "stash",
        body: "",
        author: "—",
        email: "",
        dateISO: c.stash.stashDate,
        parents: c.parents,
        parentsLanes: c.parentsLanes,
        refs: [],
        lane: c.lane,
        isStash: true,
        stashIndex: c.stash.stashIndex,
        stashMessage: c.stash.stashMessage
      };
    }
    const raw = c.raw!;
    const refs = parseRefs(raw.refs);
    return {
      id: c.id,
      hash: raw.shortHash || c.id.slice(0, 7),
      title: raw.subject,
      body: raw.body || "",
      author: raw.authorName,
      email: raw.authorEmail,
      dateISO: raw.date,
      parents: c.parents,
      parentsLanes: c.parentsLanes,
      refs,
      lane: c.lane,
      isMerge: c.parents.length > 1
    };
  });

  const total = options.unstagedCount + options.stagedCount;
  if (total > 0 && commits.length > 0) {
    const head = commits.find((c) => !c.isStash) || commits[0];
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
        remote: r.remote,
        folder
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
