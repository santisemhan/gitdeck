import { GitFileChange, GitStatus } from "../../shared/types";

function mapXYToKind(x: string, y: string): GitFileChange["kind"] {
  const pair = `${x}${y}`;
  if (pair.includes("U")) return "conflicted";
  if (x === "A" || y === "A") return "added";
  if (x === "D" || y === "D") return "deleted";
  if (x === "R" || y === "R") return "renamed";
  if (x === "C" || y === "C") return "copied";
  if (x === "?" || y === "?") return "untracked";
  return "modified";
}

export function parseStatusPorcelainV2(repoPath: string, input: string, opState: GitStatus["state"]): GitStatus {
  const lines = input.split(/\r?\n/).filter(Boolean);
  let branch = "";
  let upstream: string | undefined;
  let ahead = 0;
  let behind = 0;
  const changes: GitFileChange[] = [];

  for (const line of lines) {
    if (line.startsWith("# branch.head ")) {
      branch = line.slice("# branch.head ".length);
      continue;
    }
    if (line.startsWith("# branch.upstream ")) {
      const value = line.slice("# branch.upstream ".length);
      upstream = value === "(null)" ? undefined : value;
      continue;
    }
    if (line.startsWith("# branch.ab ")) {
      const match = line.match(/\+(-?\d+)\s+-(\d+)/);
      if (match) {
        ahead = Number(match[1]);
        behind = Number(match[2]);
      }
      continue;
    }

    if (line.startsWith("1 ")) {
      const parts = line.split(" ");
      const xy = parts[1];
      const path = parts.slice(8).join(" ");
      const x = xy[0];
      const y = xy[1];
      changes.push({
        path,
        staged: x !== ".",
        unstaged: y !== ".",
        untracked: false,
        conflicted: xy.includes("U"),
        kind: mapXYToKind(x, y)
      });
      continue;
    }

    if (line.startsWith("2 ")) {
      const tabIndex = line.indexOf("\t");
      const head = line.slice(0, tabIndex).split(" ");
      const xy = head[1];
      const paths = line.slice(tabIndex + 1).split("\t");
      const path = paths[1] ?? paths[0];
      const oldPath = paths[0];
      const x = xy[0];
      const y = xy[1];
      changes.push({
        path,
        oldPath,
        staged: x !== ".",
        unstaged: y !== ".",
        untracked: false,
        conflicted: xy.includes("U"),
        kind: mapXYToKind(x, y)
      });
      continue;
    }

    if (line.startsWith("u ")) {
      const path = line.split(" ").slice(10).join(" ");
      changes.push({
        path,
        staged: false,
        unstaged: false,
        untracked: false,
        conflicted: true,
        kind: "conflicted"
      });
      continue;
    }

    if (line.startsWith("? ")) {
      const path = line.slice(2);
      changes.push({
        path,
        staged: false,
        unstaged: true,
        untracked: true,
        conflicted: false,
        kind: "untracked"
      });
    }
  }

  if (branch === "(detached)") branch = "HEAD";
  const conflicts = changes.filter((c) => c.conflicted).map((c) => c.path);

  return {
    repoPath,
    branch,
    upstream,
    ahead,
    behind,
    // Populated by the caller (gitService.getStatus runs a separate
    // `git rev-list --count HEAD --not --remotes`). Default to 0 here so the
    // parser stays pure and standalone-testable.
    unpushed: 0,
    clean: changes.length === 0,
    state: opState,
    conflicts: {
      hasConflicts: conflicts.length > 0,
      files: conflicts
    },
    changes
  };
}
