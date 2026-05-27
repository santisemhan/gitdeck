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
