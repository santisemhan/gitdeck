import fs from "node:fs";
import path from "node:path";
import {
  CommitDetails,
  GitBranch,
  GitDiff,
  GitFileChange,
  GitOperationResult,
  GitStatus
} from "../../shared/types";
import { parseHistory, historyFormat } from "../parsers/historyParser";
import { parseStatusPorcelainV2 } from "../parsers/statusParser";
import { runCommand } from "./commandRunner";

const BIG_DIFF_LIMIT = 500_000;

function fail(result: { code: number; stdout: string; stderr: string }, fallback: string): GitOperationResult {
  return { ok: false, code: result.code, stdout: result.stdout, stderr: result.stderr, message: result.stderr || fallback };
}

export class GitService {
  async validateRepository(repoPath: string): Promise<GitOperationResult> {
    const stat = fs.existsSync(repoPath) ? fs.statSync(repoPath) : null;
    if (!stat || !stat.isDirectory()) {
      return { ok: false, code: 1, stdout: "", stderr: "", message: "Selected path is not a directory." };
    }
    const result = await runCommand("git", ["rev-parse", "--is-inside-work-tree"], repoPath);
    if (result.code !== 0 || result.stdout.trim() !== "true") {
      return { ok: false, code: result.code, stdout: result.stdout, stderr: result.stderr, message: "Folder is not a Git repository." };
    }
    return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
  }

  private async detectRepoState(repoPath: string): Promise<GitStatus["state"]> {
    const gitDir = path.join(repoPath, ".git");
    const mergeInProgress = fs.existsSync(path.join(gitDir, "MERGE_HEAD"));
    const cherryPickInProgress = fs.existsSync(path.join(gitDir, "CHERRY_PICK_HEAD"));
    const rebaseInProgress = fs.existsSync(path.join(gitDir, "rebase-merge")) || fs.existsSync(path.join(gitDir, "rebase-apply"));

    const head = await runCommand("git", ["symbolic-ref", "--quiet", "--short", "HEAD"], repoPath);
    const detachedHead = head.code !== 0;

    let operationState: GitStatus["state"]["operationState"] = "normal";
    if (cherryPickInProgress) operationState = "cherry-pick-in-progress";
    else if (mergeInProgress) operationState = "merge-in-progress";
    else if (rebaseInProgress) operationState = "rebase-in-progress";
    else if (detachedHead) operationState = "detached-head";

    return { operationState, detachedHead, mergeInProgress, rebaseInProgress, cherryPickInProgress };
  }

  async getStatus(repoPath: string): Promise<GitStatus> {
    const state = await this.detectRepoState(repoPath);
    const result = await runCommand("git", ["status", "--porcelain=v2", "--branch"], repoPath);
    if (result.code !== 0) throw new Error(result.stderr || "Unable to get status");
    return parseStatusPorcelainV2(repoPath, result.stdout, state);
  }

  async getDiff(repoPath: string, filePath: string, staged: boolean): Promise<GitDiff> {
    const args = staged ? ["diff", "--cached", "--", filePath] : ["diff", "--", filePath];
    const result = await runCommand("git", args, repoPath);
    if (result.code !== 0) throw new Error(result.stderr || "Unable to get diff");
    const text = result.stdout;
    const isBinary = /Binary files .* differ/.test(text);
    const tooLarge = text.length > BIG_DIFF_LIMIT;
    return {
      path: filePath,
      staged,
      isBinary,
      tooLarge,
      text: tooLarge ? text.slice(0, BIG_DIFF_LIMIT) + "\n\n[Diff truncated due to size]" : text
    };
  }

  async stageFile(repoPath: string, filePath: string): Promise<GitOperationResult> {
    const result = await runCommand("git", ["add", "--", filePath], repoPath);
    if (result.code !== 0) return fail(result, "Failed to stage file");
    return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
  }

  async unstageFile(repoPath: string, filePath: string): Promise<GitOperationResult> {
    const result = await runCommand("git", ["restore", "--staged", "--", filePath], repoPath);
    if (result.code !== 0) return fail(result, "Failed to unstage file");
    return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
  }

  async stageAll(repoPath: string): Promise<GitOperationResult> {
    const result = await runCommand("git", ["add", "--all"], repoPath);
    if (result.code !== 0) return fail(result, "Failed to stage all");
    return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
  }

  async unstageAll(repoPath: string): Promise<GitOperationResult> {
    const result = await runCommand("git", ["restore", "--staged", "."], repoPath);
    if (result.code !== 0) return fail(result, "Failed to unstage all");
    return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
  }

  async commit(repoPath: string, message: string): Promise<GitOperationResult> {
    if (!message.trim()) {
      return { ok: false, code: 1, stdout: "", stderr: "", message: "Commit message cannot be empty." };
    }
    const result = await runCommand("git", ["commit", "-m", message], repoPath, 60000);
    if (result.code !== 0) return fail(result, "Commit failed");
    return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
  }

  async getHistory(repoPath: string): Promise<ReturnType<typeof parseHistory>> {
    const result = await runCommand("git", ["log", "--date=iso-strict", "--decorate=short", `--format=${historyFormat}`, "-n", "200"], repoPath);
    if (result.code !== 0) throw new Error(result.stderr || "Unable to get history");
    return parseHistory(result.stdout);
  }

  async getCommitDetails(repoPath: string, commitHash: string): Promise<CommitDetails> {
    const history = await runCommand("git", ["show", "--date=iso-strict", "--decorate=short", `--format=${historyFormat}`, "-s", commitHash], repoPath);
    if (history.code !== 0) throw new Error(history.stderr || "Unable to read commit");
    const commit = parseHistory(history.stdout)[0];
    const filesOutput = await runCommand("git", ["show", "--name-status", "--format=", commitHash], repoPath);
    const patchOutput = await runCommand("git", ["show", "--format=", commitHash], repoPath);
    const files: GitFileChange[] = filesOutput.stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [status, ...rest] = line.split(/\s+/);
        const p = rest.join(" ");
        const kind = status.startsWith("R") ? "renamed" : status.startsWith("A") ? "added" : status.startsWith("D") ? "deleted" : "modified";
        return { path: p, staged: true, unstaged: false, untracked: false, conflicted: false, kind };
      });

    return { commit, files, patch: patchOutput.stdout };
  }

  async getBranches(repoPath: string): Promise<GitBranch[]> {
    const local = await runCommand("git", ["branch", "--list"], repoPath);
    const remote = await runCommand("git", ["branch", "-r"], repoPath);
    if (local.code !== 0) throw new Error(local.stderr || "Unable to list branches");

    const localBranches = local.stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => ({ name: line.replace("*", "").trim(), current: line.trim().startsWith("*"), remote: false }));

    const remoteBranches = remote.code === 0
      ? remote.stdout
          .split(/\r?\n/)
          .filter(Boolean)
          .map((line) => line.trim())
          .filter((name) => !name.includes("->"))
          .map((name) => ({ name, current: false, remote: true }))
      : [];

    return [...localBranches, ...remoteBranches];
  }

  async checkoutBranch(repoPath: string, branchName: string): Promise<GitOperationResult> {
    const result = await runCommand("git", ["checkout", branchName], repoPath);
    if (result.code !== 0) return fail(result, "Checkout failed");
    return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
  }

  async createBranch(repoPath: string, branchName: string, startPoint?: string): Promise<GitOperationResult> {
    const args = ["branch", branchName];
    if (startPoint) args.push(startPoint);
    const result = await runCommand("git", args, repoPath);
    if (result.code !== 0) return fail(result, "Create branch failed");
    return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
  }

  async pull(repoPath: string): Promise<GitOperationResult> {
    const result = await runCommand("git", ["pull"], repoPath, 120000);
    if (result.code !== 0) return fail(result, this.mapNetworkError(result.stderr));
    return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
  }

  async push(repoPath: string): Promise<GitOperationResult> {
    const result = await runCommand("git", ["push"], repoPath, 120000);
    if (result.code !== 0) return fail(result, this.mapNetworkError(result.stderr));
    return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
  }

  async cherryPick(repoPath: string, commitHash: string): Promise<GitOperationResult> {
    const result = await runCommand("git", ["cherry-pick", commitHash], repoPath);
    if (result.code !== 0) return fail(result, "Cherry-pick failed");
    return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
  }

  async continueCherryPick(repoPath: string): Promise<GitOperationResult> {
    const result = await runCommand("git", ["cherry-pick", "--continue"], repoPath);
    if (result.code !== 0) return fail(result, "Cherry-pick continue failed");
    return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
  }

  async abortCherryPick(repoPath: string): Promise<GitOperationResult> {
    const result = await runCommand("git", ["cherry-pick", "--abort"], repoPath);
    if (result.code !== 0) return fail(result, "Cherry-pick abort failed");
    return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
  }

  private mapNetworkError(stderr: string): string {
    const s = stderr.toLowerCase();
    if (s.includes("no upstream") || s.includes("has no upstream")) return "No upstream configured for current branch.";
    if (s.includes("authentication") || s.includes("could not read") || s.includes("permission denied")) return "Authentication failed.";
    if (s.includes("rejected")) return "Push rejected by remote.";
    if (s.includes("unable to access") || s.includes("could not resolve host")) return "Network error while contacting remote.";
    if (s.includes("conflict")) return "Operation has merge conflicts.";
    return "Git operation failed.";
  }
}
