import { describe, expect, it, vi } from "vitest";
import { parseRefs, toChangedFiles, toCommits } from "../src/renderer/src/utils/adapters";
import type { GitCommit, GitFileChange, GitStashEntry, GitStatus } from "../src/shared/types";

function gc(hash: string, parents: string[] = []): GitCommit {
  return {
    hash,
    shortHash: hash.slice(0, 7),
    authorName: "u",
    authorEmail: "u@x",
    date: "2026-01-01T00:00:00Z",
    subject: `subject ${hash}`,
    refs: "",
    parents,
    body: "",
  };
}

function gs(partial: Partial<GitFileChange> & Pick<GitFileChange, "path" | "kind">): GitFileChange {
  return {
    path: partial.path,
    oldPath: partial.oldPath,
    staged: partial.staged ?? false,
    unstaged: partial.unstaged ?? false,
    untracked: partial.untracked ?? false,
    conflicted: partial.conflicted ?? false,
    kind: partial.kind,
    additions: partial.additions,
    deletions: partial.deletions,
  };
}

function status(changes: GitFileChange[]): GitStatus {
  return {
    repoPath: "/r",
    branch: "main",
    ahead: 0,
    behind: 0,
    clean: changes.length === 0,
    state: {
      operationState: "normal",
      detachedHead: false,
      mergeInProgress: false,
      rebaseInProgress: false,
      cherryPickInProgress: false,
    },
    conflicts: { hasConflicts: false, files: [] },
    changes,
  };
}

function stash(index: number, parentHash: string): GitStashEntry {
  return {
    index,
    hash: `stash-${index}`,
    parentHash,
    message: `WIP on main: msg ${index}`,
    branch: "main",
    dateISO: "2026-01-01T00:00:00Z",
  };
}

describe("parseRefs", () => {
  it("keeps a single branch label when local and remote match", () => {
    const refs = "HEAD -> main, origin/main";
    const parsed = parseRefs(refs);
    const branchNames = parsed.filter((r) => r.kind === "branch").map((r) => r.name);

    expect(branchNames).toEqual(["main"]);
  });

  it("hides origin HEAD symbolic ref", () => {
    const refs = "origin/HEAD -> origin/main, origin/main";
    const parsed = parseRefs(refs);
    const branchNames = parsed.filter((r) => r.kind === "branch").map((r) => r.name);

    expect(branchNames).toEqual(["main"]);
  });

  it("hides origin HEAD without arrow", () => {
    const refs = "origin/HEAD, origin/main";
    const parsed = parseRefs(refs);
    const branchNames = parsed.filter((r) => r.kind === "branch").map((r) => r.name);

    expect(branchNames).toEqual(["main"]);
  });

  it("normalizes origin branch labels to avoid duplicates", () => {
    const refs = "main, origin/main, tag: v1.0.0";
    const parsed = parseRefs(refs);
    const branchNames = parsed.filter((r) => r.kind === "branch").map((r) => r.name);

    expect(branchNames).toEqual(["main"]);
  });
});

describe("toCommits", () => {
  it("returns empty array when history is empty", () => {
    expect(toCommits([], { unstagedCount: 0, stagedCount: 0 })).toEqual([]);
  });

  it("does not add a WIP entry when there are no local changes", () => {
    const result = toCommits([gc("a"), gc("b")], { unstagedCount: 0, stagedCount: 0 });
    expect(result.some((c) => c.isWip)).toBe(false);
  });

  it("does not add a WIP entry when history is empty even with local changes", () => {
    const result = toCommits([], { unstagedCount: 3, stagedCount: 0 });
    expect(result).toEqual([]);
  });

  it("adds a single WIP entry at the top when unstaged+staged > 0", () => {
    const result = toCommits([gc("a", ["b"]), gc("b")], { unstagedCount: 2, stagedCount: 1 });
    expect(result[0].isWip).toBe(true);
    expect(result[0].parents).toEqual(["a"]);
    expect(result.filter((c) => c.isWip).length).toBe(1);
  });

  it("WIP includes additions count from total local changes", () => {
    const result = toCommits([gc("a")], { unstagedCount: 4, stagedCount: 1 });
    expect(result[0].additions).toBe(5);
  });

  it("does NOT duplicate WIP when called multiple times (idempotent across pages)", () => {
    // Simulates loading a second page: the hook keeps the FULL history and re-runs
    // toCommits. WIP must be added exactly once regardless of how many pages exist.
    const fullHistory = [gc("a", ["b"]), gc("b", ["c"]), gc("c", ["d"]), gc("d")];
    const result = toCommits(fullHistory, { unstagedCount: 1, stagedCount: 0 });
    expect(result.filter((c) => c.isWip).length).toBe(1);
  });

  it("injects a stash entry above its parent commit", () => {
    const result = toCommits([gc("a", ["b"]), gc("b", ["c"]), gc("c")], {
      unstagedCount: 0,
      stagedCount: 0,
      stashes: [stash(0, "b")],
    });
    const stashCommits = result.filter((c) => c.isStash);
    expect(stashCommits).toHaveLength(1);
    expect(stashCommits[0].stashIndex).toBe(0);
    expect(stashCommits[0].parents).toEqual(["b"]);
    const stashIdx = result.findIndex((c) => c.isStash);
    const parentIdx = result.findIndex((c) => c.id === "b");
    expect(stashIdx).toBeLessThan(parentIdx);
  });

  it("skips a stash whose parent is not in history and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = toCommits([gc("a"), gc("b")], {
      unstagedCount: 0,
      stagedCount: 0,
      stashes: [stash(0, "missing-parent")],
    });
    expect(result.some((c) => c.isStash)).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("marks commits with multiple parents as merge commits", () => {
    const result = toCommits([gc("m", ["a", "b"]), gc("a"), gc("b")], {
      unstagedCount: 0,
      stagedCount: 0,
    });
    expect(result.find((c) => c.id === "m")?.isMerge).toBe(true);
    expect(result.find((c) => c.id === "a")?.isMerge).toBe(false);
  });
});

describe("toChangedFiles", () => {
  it("splits files into staged and unstaged buckets", () => {
    const { staged, unstaged } = toChangedFiles(
      status([
        gs({ path: "a.ts", kind: "modified", staged: true }),
        gs({ path: "b.ts", kind: "modified", unstaged: true }),
      ]),
    );
    expect(staged.map((f) => f.path)).toEqual(["a.ts"]);
    expect(unstaged.map((f) => f.path)).toEqual(["b.ts"]);
  });

  it("places a file in BOTH buckets when staged and unstaged", () => {
    const { staged, unstaged } = toChangedFiles(
      status([gs({ path: "x.ts", kind: "modified", staged: true, unstaged: true })]),
    );
    expect(staged).toHaveLength(1);
    expect(unstaged).toHaveLength(1);
  });

  it("counts untracked files as unstaged", () => {
    const { staged, unstaged } = toChangedFiles(
      status([gs({ path: "new.ts", kind: "untracked", untracked: true })]),
    );
    expect(staged).toHaveLength(0);
    expect(unstaged).toHaveLength(1);
    expect(unstaged[0].status).toBe("added");
  });

  it("preserves the renamed-from path", () => {
    const { staged } = toChangedFiles(
      status([gs({ path: "new.ts", oldPath: "old.ts", kind: "renamed", staged: true })]),
    );
    expect(staged[0].status).toBe("renamed");
    expect(staged[0].renamedFrom).toBe("old.ts");
  });
});
