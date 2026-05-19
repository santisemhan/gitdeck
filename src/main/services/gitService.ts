import fs from "node:fs";
import path from "node:path";
import { simpleGit } from "simple-git";
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
type CommandResult = { code: number; stdout: string; stderr: string };

const BIG_DIFF_LIMIT = 500_000;

function fail(result: { code: number; stdout: string; stderr: string }, fallback: string): GitOperationResult {
  return { ok: false, code: result.code, stdout: result.stdout, stderr: result.stderr, message: result.stderr || fallback };
}

async function runGit(repoPath: string, args: string[]): Promise<CommandResult> {
  try {
    const stdout = await simpleGit({ baseDir: repoPath, binary: "git" }).raw(args);
    return { code: 0, stdout: stdout.trimEnd(), stderr: "" };
  } catch (error) {
    const err = error as {
      message?: string;
      git?: { stdout?: string; stderr?: string; exitCode?: number };
      stdout?: string;
      stderr?: string;
      exitCode?: number;
    };
    return {
      code: err.git?.exitCode ?? err.exitCode ?? 1,
      stdout: (err.git?.stdout ?? err.stdout ?? "").trimEnd(),
      stderr: (err.git?.stderr ?? err.stderr ?? err.message ?? "").trimEnd()
    };
  }
}

export class GitService {
  async validateRepository(repoPath: string): Promise<GitOperationResult> {
    const stat = fs.existsSync(repoPath) ? fs.statSync(repoPath) : null;
    if (!stat || !stat.isDirectory()) {
      return { ok: false, code: 1, stdout: "", stderr: "", message: "Selected path is not a directory." };
    }
    const result = await runGit(repoPath, ["rev-parse", "--is-inside-work-tree"]);
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

    const head = await runGit(repoPath, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
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
    const result = await runGit(repoPath, ["status", "--porcelain=v2", "--branch"]);
    if (result.code !== 0) throw new Error(result.stderr || "Unable to get status");
    return parseStatusPorcelainV2(repoPath, result.stdout, state);
  }

  async getDiff(repoPath: string, filePath: string, staged: boolean): Promise<GitDiff> {
    const args = staged ? ["diff", "--cached", "--", filePath] : ["diff", "--", filePath];
    const result = await runGit(repoPath, args);
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
    const result = await runGit(repoPath, ["add", "--", filePath]);
    if (result.code !== 0) return fail(result, "Failed to stage file");
    return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
  }

  async unstageFile(repoPath: string, filePath: string): Promise<GitOperationResult> {
    const result = await runGit(repoPath, ["restore", "--staged", "--", filePath]);
    if (result.code !== 0) return fail(result, "Failed to unstage file");
    return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
  }

  async stageAll(repoPath: string): Promise<GitOperationResult> {
    const result = await runGit(repoPath, ["add", "--all"]);
    if (result.code !== 0) return fail(result, "Failed to stage all");
    return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
  }

  async unstageAll(repoPath: string): Promise<GitOperationResult> {
    const result = await runGit(repoPath, ["restore", "--staged", "."]);
    if (result.code !== 0) return fail(result, "Failed to unstage all");
    return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
  }

  async commit(repoPath: string, message: string): Promise<GitOperationResult> {
    if (!message.trim()) {
      return { ok: false, code: 1, stdout: "", stderr: "", message: "Commit message cannot be empty." };
    }
    const result = await runGit(repoPath, ["commit", "-m", message]);
    if (result.code !== 0) return fail(result, "Commit failed");
    return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
  }

  async getHistory(repoPath: string): Promise<ReturnType<typeof parseHistory>> {
    const result = await runGit(repoPath, ["log", "--date=iso-strict", "--decorate=short", `--format=${historyFormat}`, "-n", "200", "--branches", "--remotes", "--tags", "HEAD"]);
    if (result.code !== 0) throw new Error(result.stderr || "Unable to get history");
    return parseHistory(result.stdout);
  }

  async getCommitFileDiff(repoPath: string, commitHash: string, filePath: string): Promise<GitDiff> {
    const result = await runGit(repoPath, ["show", commitHash, "--format=", "--", filePath]);
    if (result.code !== 0) throw new Error(result.stderr || "Unable to get commit diff");
    const text = result.stdout;
    const isBinary = /Binary files .* differ/.test(text);
    const tooLarge = text.length > BIG_DIFF_LIMIT;
    return {
      path: filePath,
      staged: false,
      isBinary,
      tooLarge,
      text: tooLarge ? text.slice(0, BIG_DIFF_LIMIT) + "\n\n[Diff truncated due to size]" : text
    };
  }

  async getFileContent(repoPath: string, filePath: string, source: "unstaged" | "staged" | "commit", commitHash?: string): Promise<{ text: string; isBinary: boolean }> {
    const BIG_FILE_LIMIT = 500_000;
    let text: string;
    if (source === "unstaged") {
      const fullPath = path.join(repoPath, filePath);
      const buf = fs.readFileSync(fullPath);
      const isBinary = buf.slice(0, 8000).includes(0);
      if (isBinary) return { text: "", isBinary: true };
      text = buf.toString("utf-8");
    } else if (source === "staged") {
      const result = await runGit(repoPath, ["show", `:${filePath}`]);
      if (result.code !== 0) throw new Error(result.stderr || "Unable to read staged file");
      text = result.stdout;
    } else {
      if (!commitHash) throw new Error("commitHash required for commit source");
      const result = await runGit(repoPath, ["show", `${commitHash}:${filePath}`]);
      if (result.code !== 0) throw new Error(result.stderr || "Unable to read file from commit");
      text = result.stdout;
    }
    const isBinary = false;
    if (text.length > BIG_FILE_LIMIT) text = text.slice(0, BIG_FILE_LIMIT) + "\n\n[File truncated due to size]";
    return { text, isBinary };
  }

  async getCommitDetails(repoPath: string, commitHash: string): Promise<CommitDetails> {
    const history = await runGit(repoPath, ["show", "--date=iso-strict", "--decorate=short", `--format=${historyFormat}`, "-s", commitHash]);
    if (history.code !== 0) throw new Error(history.stderr || "Unable to read commit");
    const commit = parseHistory(history.stdout)[0];
    const filesOutput = await runGit(repoPath, ["show", "--name-status", "--format=", commitHash]);
    const numstatOutput = await runGit(repoPath, ["show", "--numstat", "--format=", commitHash]);
    const parentsOutput = await runGit(repoPath, ["show", "--format=%P", "-s", commitHash]);
    const patchOutput = await runGit(repoPath, ["show", "--format=", commitHash]);
    const numstats = new Map<string, { additions: number; deletions: number }>();

    for (const line of numstatOutput.stdout.split(/\r?\n/).filter(Boolean)) {
      const [addRaw, delRaw, ...pathParts] = line.split(/\s+/);
      const statPath = pathParts.join(" ");
      const additions = addRaw === "-" ? 0 : Number(addRaw);
      const deletions = delRaw === "-" ? 0 : Number(delRaw);
      numstats.set(statPath, { additions, deletions });
    }

    const files: GitFileChange[] = filesOutput.stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [status, ...rest] = line.split(/\s+/);
        const p = rest.join(" ");
        const kind = status.startsWith("R") ? "renamed" : status.startsWith("A") ? "added" : status.startsWith("D") ? "deleted" : "modified";
        const counts = numstats.get(p);
        return { path: p, staged: true, unstaged: false, untracked: false, conflicted: false, kind, additions: counts?.additions, deletions: counts?.deletions };
      });

    return {
      commit,
      files,
      patch: patchOutput.stdout,
      parentHashes: parentsOutput.stdout.trim().split(/\s+/).filter(Boolean)
    };
  }

  async getBranches(repoPath: string): Promise<GitBranch[]> {
    const local = await runGit(repoPath, ["branch", "--list"]);
    const remote = await runGit(repoPath, ["branch", "-r"]);
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
    const result = await runGit(repoPath, ["checkout", branchName]);
    if (result.code !== 0) return fail(result, "Checkout failed");
    return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
  }

  async checkoutRemoteBranch(repoPath: string, remoteBranch: string): Promise<GitOperationResult> {
    const trimmed = remoteBranch.trim();
    if (!trimmed.includes("/")) {
      return { ok: false, code: 1, stdout: "", stderr: "", message: "Invalid remote branch name" };
    }

    const slashIndex = trimmed.indexOf("/");
    const localName = trimmed.slice(slashIndex + 1);

    const hasLocal = await runGit(repoPath, ["show-ref", "--verify", "--quiet", `refs/heads/${localName}`]);
    if (hasLocal.code === 0) {
      return this.checkoutBranch(repoPath, localName);
    }

    const trackResult = await runGit(repoPath, ["checkout", "--track", "-b", localName, trimmed]);
    if (trackResult.code !== 0) return fail(trackResult, "Checkout remote branch failed");
    return { ok: true, code: 0, stdout: trackResult.stdout, stderr: trackResult.stderr };
  }

  async createBranch(repoPath: string, branchName: string, startPoint?: string): Promise<GitOperationResult> {
    const args = ["branch", branchName];
    if (startPoint) args.push(startPoint);
    const result = await runGit(repoPath, args);
    if (result.code !== 0) return fail(result, "Create branch failed");
    return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
  }

  async pull(repoPath: string): Promise<GitOperationResult> {
    const result = await runGit(repoPath, ["pull"]);
    if (result.code !== 0) return fail(result, this.mapNetworkError(result.stderr));
    return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
  }

  async push(repoPath: string): Promise<GitOperationResult> {
    const result = await runGit(repoPath, ["push"]);
    if (result.code !== 0) return fail(result, this.mapNetworkError(result.stderr));
    return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
  }

  async cherryPick(repoPath: string, commitHash: string): Promise<GitOperationResult> {
    const result = await runGit(repoPath, ["cherry-pick", commitHash]);
    if (result.code !== 0) return fail(result, "Cherry-pick failed");
    return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
  }

  async continueCherryPick(repoPath: string): Promise<GitOperationResult> {
    const result = await runGit(repoPath, ["cherry-pick", "--continue"]);
    if (result.code !== 0) return fail(result, "Cherry-pick continue failed");
    return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
  }

  async abortCherryPick(repoPath: string): Promise<GitOperationResult> {
    const result = await runGit(repoPath, ["cherry-pick", "--abort"]);
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
