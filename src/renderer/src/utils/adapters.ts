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
    if (part === "HEAD") continue; // detached HEAD marker — no pill needed

    // Current local branch: "HEAD -> refs/heads/main" (full) or "HEAD -> main" (short fallback)
    if (part.startsWith("HEAD -> ")) {
      const ref = part.slice("HEAD -> ".length);
      const name = ref.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : ref;
      out.push({ kind: "branch", name, current: true });
      continue;
    }

    // Tag: "tag: refs/tags/v1.0" (full) or "tag: v1.0" (short fallback)
    if (part.startsWith("tag: ")) {
      const ref = part.slice("tag: ".length);
      const name = ref.startsWith("refs/tags/") ? ref.slice("refs/tags/".length) : ref;
      out.push({ kind: "tag", name });
      continue;
    }

    // Full local branch: "refs/heads/feature/foo"
    if (part.startsWith("refs/heads/")) {
      out.push({ kind: "branch", name: part.slice("refs/heads/".length) });
      continue;
    }

    // Full remote-tracking branch: "refs/remotes/origin/main"
    if (part.startsWith("refs/remotes/")) {
      const rest = part.slice("refs/remotes/".length); // e.g. "origin/main"
      const slash = rest.indexOf("/");
      if (slash < 0) continue; // malformed
      const remote = rest.slice(0, slash);
      const name = rest.slice(slash + 1);
      if (name === "HEAD") continue; // skip origin/HEAD
      out.push({ kind: "branch", name, remote });
      continue;
    }

    // Short-format fallback (no refs/ prefix): skip origin/HEAD-style entries,
    // then treat anything with "remote/" prefix as a remote ref.
    if (/^[^/]+\/HEAD(\s+->\s+.+)?$/.test(part)) continue;
    const shortRemoteMatch = part.match(/^([a-zA-Z0-9_.-]+)\/(.+)$/);
    if (shortRemoteMatch) {
      out.push({ kind: "branch", name: shortRemoteMatch[2], remote: shortRemoteMatch[1] });
    } else {
      out.push({ kind: "branch", name: part });
    }
  }

  // Merge local + remote entries for the same branch name into a single pill.
  // Local-only → hasLocal: true, no remote
  // Remote-only → hasLocal: false, remote: "origin"
  // Both → hasLocal: true, remote: "origin"
  const merged: CommitRef[] = [];
  for (const ref of out) {
    if (ref.kind !== "branch") {
      // Tags: simple dedup by name
      if (!merged.some((m) => m.kind === ref.kind && m.name === ref.name)) {
        merged.push(ref);
      }
      continue;
    }

    const idx = merged.findIndex((m) => m.kind === "branch" && m.name === ref.name);

    if (idx === -1) {
      // First time we see this branch name
      merged.push(ref.remote
        ? { ...ref, hasLocal: false }   // remote-only so far
        : { ...ref, hasLocal: true }    // local (may gain remote later)
      );
    } else {
      const existing = merged[idx]!;
      if (ref.remote && !existing.remote) {
        // Had local, now also have remote
        merged[idx] = { ...existing, remote: ref.remote, hasLocal: true };
      } else if (!ref.remote && existing.remote) {
        // Had remote, now also have local
        merged[idx] = { ...existing, current: ref.current || existing.current, hasLocal: true };
      } else if (ref.current && !existing.current) {
        merged[idx] = { ...existing, current: true };
      }
      // exact duplicate → ignore
    }
  }
  return merged;
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
    wipCounts?: {
      added: number;
      modified: number;
      deleted: number;
      renamed: number;
    };
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
      additions: total,
      wipCounts: options.wipCounts
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
