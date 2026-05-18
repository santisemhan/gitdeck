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
});
