import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { runCommand } from "../src/main/services/commandRunner";
import { GitService } from "../src/main/services/gitService";

describe("GitService integration", () => {
  let repo: string;
  const service = new GitService();

  beforeEach(async () => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), "gitdeck-test-"));
    await runCommand("git", ["init"], repo);
    await runCommand("git", ["config", "user.name", "Test User"], repo);
    await runCommand("git", ["config", "user.email", "test@example.com"], repo);
    fs.writeFileSync(path.join(repo, "a.txt"), "hello\n", "utf8");
    await runCommand("git", ["add", "a.txt"], repo);
    await runCommand("git", ["commit", "-m", "initial"], repo);
  });

  it("reads status and history", async () => {
    fs.writeFileSync(path.join(repo, "a.txt"), "hello\nworld\n", "utf8");
    const status = await service.getStatus(repo);
    expect(status.clean).toBe(false);
    const history = await service.getHistory(repo);
    expect(history.length).toBeGreaterThan(0);
  });

  it("stages and commits", async () => {
    fs.writeFileSync(path.join(repo, "b.txt"), "new\n", "utf8");
    const stage = await service.stageFile(repo, "b.txt");
    expect(stage.ok).toBe(true);
    const commit = await service.commit(repo, "add b");
    expect(commit.ok).toBe(true);
  });

  it("reports ahead and unpushed > 0 after a local commit on a branch with upstream", async () => {
    // Create a bare remote, set it up, then make a local commit that's ahead of remote.
    const remote = fs.mkdtempSync(path.join(os.tmpdir(), "gitdeck-remote-"));
    await runCommand("git", ["init", "--bare"], remote);
    await runCommand("git", ["remote", "add", "origin", remote], repo);
    await runCommand("git", ["push", "-u", "origin", "HEAD"], repo);

    // Sanity: right after push, nothing ahead.
    let status = await service.getStatus(repo);
    expect(status.ahead).toBe(0);
    expect(status.behind).toBe(0);
    expect(status.unpushed).toBe(0);

    // Now make a local commit. ahead AND unpushed should both become 1.
    fs.writeFileSync(path.join(repo, "c.txt"), "c\n", "utf8");
    await runCommand("git", ["add", "c.txt"], repo);
    await runCommand("git", ["commit", "-m", "add c"], repo);

    status = await service.getStatus(repo);
    expect(status.ahead).toBe(1);
    expect(status.behind).toBe(0);
    expect(status.unpushed).toBe(1);
  });

  it("reports unpushed > 0 on a branch without upstream", async () => {
    // Add a remote and push main so origin/main exists, then switch to a brand-new
    // branch that has NO upstream configured.
    const remote = fs.mkdtempSync(path.join(os.tmpdir(), "gitdeck-remote-"));
    await runCommand("git", ["init", "--bare"], remote);
    await runCommand("git", ["remote", "add", "origin", remote], repo);
    await runCommand("git", ["push", "-u", "origin", "HEAD"], repo);

    await runCommand("git", ["checkout", "-b", "feature-x"], repo);
    fs.writeFileSync(path.join(repo, "f.txt"), "f\n", "utf8");
    await runCommand("git", ["add", "f.txt"], repo);
    await runCommand("git", ["commit", "-m", "feature commit"], repo);

    const status = await service.getStatus(repo);
    // No upstream → ahead stays at 0 (porcelain doesn't emit branch.ab).
    expect(status.ahead).toBe(0);
    // But unpushed should be 1, so the badge will still show.
    expect(status.unpushed).toBe(1);
  });

  it("paginates history via limit and skip", async () => {
    // Create 4 extra commits on top of the initial one, for a total of 5.
    for (let i = 0; i < 4; i++) {
      fs.writeFileSync(path.join(repo, `f${i}.txt`), `${i}\n`, "utf8");
      await runCommand("git", ["add", `f${i}.txt`], repo);
      await runCommand("git", ["commit", "-m", `commit ${i}`], repo);
    }

    const firstTwo = await service.getHistory(repo, { limit: 2, skip: 0 });
    expect(firstTwo).toHaveLength(2);
    expect(firstTwo[0].subject).toBe("commit 3");

    const nextTwo = await service.getHistory(repo, { limit: 2, skip: 2 });
    expect(nextTwo).toHaveLength(2);
    expect(nextTwo[0].subject).toBe("commit 1");

    const tail = await service.getHistory(repo, { limit: 200, skip: 4 });
    expect(tail).toHaveLength(1);
    expect(tail[0].subject).toBe("initial");
  });
});
