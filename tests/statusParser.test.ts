import { describe, expect, it } from "vitest";
import { parseStatusPorcelainV2 } from "../src/main/parsers/statusParser";

const normalState = {
  operationState: "normal" as const,
  detachedHead: false,
  mergeInProgress: false,
  rebaseInProgress: false,
  cherryPickInProgress: false
};

describe("parseStatusPorcelainV2", () => {
  it("parses ahead/behind and upstream", () => {
    const input = [
      "# branch.oid abc",
      "# branch.head main",
      "# branch.upstream origin/main",
      "# branch.ab +2 -1"
    ].join("\n");
    const status = parseStatusPorcelainV2("/repo", input, normalState);
    expect(status.branch).toBe("main");
    expect(status.upstream).toBe("origin/main");
    expect(status.ahead).toBe(2);
    expect(status.behind).toBe(1);
  });

  it("parses untracked deleted renamed conflicted", () => {
    const input = [
      "# branch.head main",
      "1 .D N... 100644 100644 100644 a b deleted.txt",
      "2 R. N... 100644 100644 100644 a b R100 old.txt\tnew.txt",
      "u UU N... 100644 100644 100644 100644 a b c conflict.txt",
      "? new-file.ts"
    ].join("\n");
    const status = parseStatusPorcelainV2("/repo", input, normalState);
    expect(status.changes.some((c) => c.kind === "deleted")).toBe(true);
    expect(status.changes.some((c) => c.kind === "renamed")).toBe(true);
    expect(status.changes.some((c) => c.kind === "conflicted")).toBe(true);
    expect(status.changes.some((c) => c.kind === "untracked")).toBe(true);
  });

  it("handles detached head and no upstream", () => {
    const input = ["# branch.head (detached)", "# branch.upstream (null)"].join("\n");
    const status = parseStatusPorcelainV2("/repo", input, {
      ...normalState,
      operationState: "detached-head"
    });
    expect(status.branch).toBe("HEAD");
    expect(status.upstream).toBeUndefined();
    expect(status.state.operationState).toBe("detached-head");
  });

  it("keeps in-progress operation state", () => {
    const input = "# branch.head main";
    const cherry = parseStatusPorcelainV2("/repo", input, { ...normalState, operationState: "cherry-pick-in-progress", cherryPickInProgress: true });
    const merge = parseStatusPorcelainV2("/repo", input, { ...normalState, operationState: "merge-in-progress", mergeInProgress: true });
    const rebase = parseStatusPorcelainV2("/repo", input, { ...normalState, operationState: "rebase-in-progress", rebaseInProgress: true });
    expect(cherry.state.operationState).toBe("cherry-pick-in-progress");
    expect(merge.state.operationState).toBe("merge-in-progress");
    expect(rebase.state.operationState).toBe("rebase-in-progress");
  });
});
