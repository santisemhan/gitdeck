import { describe, expect, it } from "vitest";
import { parseRefs } from "../src/renderer/src/utils/adapters";

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

    expect(branchNames).toEqual(["origin/main"]);
  });

  it("hides origin HEAD without arrow", () => {
    const refs = "origin/HEAD, origin/main";
    const parsed = parseRefs(refs);
    const branchNames = parsed.filter((r) => r.kind === "branch").map((r) => r.name);

    expect(branchNames).toEqual(["origin/main"]);
  });
});
