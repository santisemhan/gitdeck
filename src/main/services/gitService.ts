import fs from "node:fs";
import path from "node:path";
import { simpleGit } from "simple-git";
import {
  CommitDetails,
  GitBranch,
  GitDiff,
  GitFileChange,
  GitOperationResult,
  GitSplitContent,
  GitStashEntry,
  GitStatus
} from "../../shared/types";
import { parseHistory, historyFormat } from "../parsers/historyParser";
import { parseStatusPorcelainV2 } from "../parsers/statusParser";
type CommandResult = { code: number; stdout: string; stderr: string };

const BIG_DIFF_LIMIT = 500_000;

function fail(result: { code: number; stdout: string; stderr: string }, fallback: string): GitOperationResult {
  return { ok: false, code: result.code, stdout: result.stdout, stderr: result.stderr, message: result.stderr || fallback };
}

function ok(result: CommandResult): GitOperationResult {
  return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
}

function withTruncation(text: string, limit: number, message: string): string {
  return text.length > limit ? `${text.slice(0, limit)}\n\n[${message}]` : text;
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
  private listFilesRecursively(absDir: string, relDir: string): string[] {
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const absChild = path.join(absDir, entry.name);
      const relChild = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        files.push(...this.listFilesRecursively(absChild, relChild));
      } else {
        files.push(relChild);
      }
    }
    return files;
  }

  private normalizeUntrackedChanges(repoPath: string, changes: GitFileChange[]): GitFileChange[] {
    const out: GitFileChange[] = [];
    const seen = new Set<string>();

    for (const change of changes) {
      const normalizedPath = change.path.replace(/\\/g, "/");

      if (!change.untracked) {
        const key = `${change.staged ? "S" : ""}${change.unstaged ? "U" : ""}:${normalizedPath}`;
        if (!seen.has(key)) {
          out.push({ ...change, path: normalizedPath });
          seen.add(key);
        }
        continue;
      }

      const trimmedPath = normalizedPath.replace(/\/+$/, "");
      const absPath = path.join(repoPath, trimmedPath);
      const isDirectory = fs.existsSync(absPath) && fs.statSync(absPath).isDirectory();

      if (!isDirectory) {
        const key = `U:${normalizedPath}`;
        if (!seen.has(key)) {
          out.push({ ...change, path: normalizedPath });
          seen.add(key);
        }
        continue;
      }

      const files = this.listFilesRecursively(absPath, trimmedPath).sort((a, b) => a.localeCompare(b));
      if (files.length === 0) {
        const key = `U:${normalizedPath}`;
        if (!seen.has(key)) {
          out.push({ ...change, path: normalizedPath });
          seen.add(key);
        }
        continue;
      }

      for (const filePath of files) {
        const key = `U:${filePath}`;
        if (seen.has(key)) continue;
        out.push({
          ...change,
          path: filePath,
          staged: false,
          unstaged: true,
          untracked: true,
          conflicted: false,
          kind: "untracked"
        });
        seen.add(key);
      }
    }

    return out;
  }

  private readUnstagedFile(repoPath: string, filePath: string): { text: string; isBinary: boolean } {
    const fullPath = path.join(repoPath, filePath);
    const buf = fs.readFileSync(fullPath);
    const isBinary = buf.slice(0, 8000).includes(0);
    if (isBinary) return { text: "", isBinary: true };
    return { text: buf.toString("utf-8"), isBinary: false };
  }

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
    const result = await runGit(repoPath, ["status", "--porcelain=v2", "--branch", "-uall"]);
    if (result.code !== 0) throw new Error(result.stderr || "Unable to get status");
    const status = parseStatusPorcelainV2(repoPath, result.stdout, state);
    const changes = this.normalizeUntrackedChanges(repoPath, status.changes);
    return {
      ...status,
      clean: changes.length === 0,
      changes
    };
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
      text: withTruncation(text, BIG_DIFF_LIMIT, "Diff truncated due to size")
    };
  }

  async stageFile(repoPath: string, filePath: string): Promise<GitOperationResult> {
    const result = await runGit(repoPath, ["add", "--", filePath]);
    if (result.code !== 0) return fail(result, "Failed to stage file");
    return ok(result);
  }

  async unstageFile(repoPath: string, filePath: string): Promise<GitOperationResult> {
    const result = await runGit(repoPath, ["restore", "--staged", "--", filePath]);
    if (result.code !== 0) return fail(result, "Failed to unstage file");
    return ok(result);
  }

  async stageAll(repoPath: string): Promise<GitOperationResult> {
    const result = await runGit(repoPath, ["add", "--all"]);
    if (result.code !== 0) return fail(result, "Failed to stage all");
    return ok(result);
  }

  async unstageAll(repoPath: string): Promise<GitOperationResult> {
    const result = await runGit(repoPath, ["restore", "--staged", "."]);
    if (result.code !== 0) return fail(result, "Failed to unstage all");
    return ok(result);
  }

  async discardAll(repoPath: string): Promise<GitOperationResult> {
    const unstage = await runGit(repoPath, ["restore", "--staged", "."]);
    if (unstage.code !== 0) return fail(unstage, "Failed to discard all changes");

    const restore = await runGit(repoPath, ["restore", "."]);
    if (restore.code !== 0) return fail(restore, "Failed to discard all changes");

    const clean = await runGit(repoPath, ["clean", "-fd"]);
    if (clean.code !== 0) return fail(clean, "Failed to discard all changes");

    return {
      ok: true,
      code: 0,
      stdout: [unstage.stdout, restore.stdout, clean.stdout].filter(Boolean).join("\n"),
      stderr: [unstage.stderr, restore.stderr, clean.stderr].filter(Boolean).join("\n")
    };
  }

  async commit(repoPath: string, message: string): Promise<GitOperationResult> {
    if (!message.trim()) {
      return { ok: false, code: 1, stdout: "", stderr: "", message: "Commit message cannot be empty." };
    }
    const result = await runGit(repoPath, ["commit", "-m", message]);
    if (result.code !== 0) return fail(result, "Commit failed");
    return ok(result);
  }

  async getHistory(repoPath: string): Promise<ReturnType<typeof parseHistory>> {
    const result = await runGit(repoPath, ["log", "--date=iso-strict", "--decorate=full", `--format=${historyFormat}`, "-n", "200", "--branches", "--remotes", "--tags", "HEAD"]);
    if (result.code !== 0) throw new Error(result.stderr || "Unable to get history");
    return parseHistory(result.stdout);
  }

  async getFileHistory(
    repoPath: string,
    filePath: string,
    opts?: { limit?: number; skip?: number }
  ): Promise<import("../../shared/types").FileHistoryEntry[]> {
    const limit = opts?.limit ?? 100;
    const skip = opts?.skip ?? 0;
    const result = await runGit(repoPath, [
      "log",
      "--follow",
      "--date=iso-strict",
      "--decorate=full",
      `--format=${historyFormat}`,
      "-n",
      String(limit),
      "--skip",
      String(skip),
      "--",
      filePath,
    ]);
    if (result.code !== 0) throw new Error(result.stderr || "Unable to get file history");

    return parseHistory(result.stdout).map((commit) => ({ commit, pathAtCommit: filePath }));
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
      text: withTruncation(text, BIG_DIFF_LIMIT, "Diff truncated due to size")
    };
  }

  async getFileContent(repoPath: string, filePath: string, source: "unstaged" | "staged" | "commit", commitHash?: string): Promise<{ text: string; isBinary: boolean }> {
    const BIG_FILE_LIMIT = 500_000;
    let text: string;
    if (source === "unstaged") {
      const file = this.readUnstagedFile(repoPath, filePath);
      if (file.isBinary) return { text: "", isBinary: true };
      text = file.text;
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
    text = withTruncation(text, BIG_FILE_LIMIT, "File truncated due to size");
    return { text, isBinary };
  }

  async getSplitContent(repoPath: string, filePath: string, source: "unstaged" | "staged" | "commit", commitHash?: string): Promise<GitSplitContent> {
    const BIG_FILE_LIMIT = 500_000;
    const worktreeExists = fs.existsSync(path.join(repoPath, filePath));
    const readAt = async (where: "worktree" | "index" | "commit"): Promise<{ text: string; isBinary: boolean }> => {
      if (where === "worktree") {
        if (!worktreeExists) return { text: "", isBinary: false };
        return this.readUnstagedFile(repoPath, filePath);
      }
      if (where === "index") {
        const result = await runGit(repoPath, ["show", `:${filePath}`]);
        if (result.code !== 0) return { text: "", isBinary: false };
        return { text: result.stdout, isBinary: false };
      }
      if (!commitHash) return { text: "", isBinary: false };
      const result = await runGit(repoPath, ["show", `${commitHash}:${filePath}`]);
      if (result.code !== 0) return { text: "", isBinary: false };
      return { text: result.stdout, isBinary: false };
    };

    const sourceText = await readAt(source === "unstaged" ? "worktree" : source === "staged" ? "index" : "commit");
    if (sourceText.isBinary) return { oldText: "", newText: "", isBinary: true };

    let target: { text: string; isBinary: boolean };
    if (source === "unstaged") {
      target = await readAt("index");
    } else {
      const parent = source === "commit"
        ? await runGit(repoPath, ["show", "--format=%P", "-s", commitHash || ""])
        : await runGit(repoPath, ["rev-parse", "HEAD"]);
      const parentHash = (parent.stdout.trim().split(/\s+/)[0] || "").trim();
      if (!parentHash) target = { text: "", isBinary: false };
      else {
        const ref = `${parentHash}:${filePath}`;
        const result = await runGit(repoPath, ["show", ref]);
        target = result.code === 0 ? { text: result.stdout, isBinary: false } : { text: "", isBinary: false };
      }
    }
    if (target.isBinary) return { oldText: "", newText: "", isBinary: true };

    const oldText = withTruncation(target.text, BIG_FILE_LIMIT, "File truncated due to size");
    const newText = withTruncation(sourceText.text, BIG_FILE_LIMIT, "File truncated due to size");
    return { oldText, newText, isBinary: false };
  }

  async getCommitDetails(repoPath: string, commitHash: string): Promise<CommitDetails> {
    const history = await runGit(repoPath, ["show", "--date=iso-strict", "--decorate=full", `--format=${historyFormat}`, "-s", commitHash]);
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
    return ok(result);
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
    return ok(trackResult);
  }

  async createBranch(repoPath: string, branchName: string, startPoint?: string): Promise<GitOperationResult> {
    const args = ["checkout", "-b", branchName];
    if (startPoint) args.push(startPoint);
    const result = await runGit(repoPath, args);
    if (result.code !== 0) return fail(result, "Create branch failed");
    return ok(result);
  }

  async deleteBranch(repoPath: string, branchName: string): Promise<GitOperationResult> {
    const result = await runGit(repoPath, ["branch", "-d", branchName]);
    if (result.code === 0) return ok(result);

    const stderrLower = result.stderr.toLowerCase();
    const isCurrentBranchError =
      stderrLower.includes("cannot delete branch") && stderrLower.includes("checked out");
    if (isCurrentBranchError) return fail(result, "Cannot delete the current branch");

    const forceResult = await runGit(repoPath, ["branch", "-D", branchName]);
    if (forceResult.code !== 0) return fail(forceResult, "Delete branch failed");
    return ok(forceResult);
  }

  async renameBranch(repoPath: string, oldName: string, newName: string): Promise<GitOperationResult> {
    const result = await runGit(repoPath, ["branch", "-m", oldName, newName]);
    if (result.code !== 0) return fail(result, "Rename branch failed");
    return ok(result);
  }

  async pull(repoPath: string): Promise<GitOperationResult> {
    const result = await runGit(repoPath, ["pull"]);
    if (result.code !== 0) return fail(result, this.mapNetworkError(result.stderr));
    return ok(result);
  }

  async push(repoPath: string): Promise<GitOperationResult> {
    const result = await runGit(repoPath, ["push"]);
    if (result.code === 0) return ok(result);

    const stderrLower = result.stderr.toLowerCase();
    const noUpstream = stderrLower.includes("has no upstream") || stderrLower.includes("set-upstream");
    if (!noUpstream) return fail(result, this.mapNetworkError(result.stderr));

    const head = await runGit(repoPath, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
    const branchName = head.stdout.trim();
    if (head.code !== 0 || !branchName) {
      return fail(result, "Current branch has no upstream and could not be detected.");
    }

    const remotes = await runGit(repoPath, ["remote"]);
    const remoteNames = remotes.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const remoteName = remoteNames.includes("origin") ? "origin" : remoteNames[0];
    if (!remoteName) {
      return fail(result, "No remote configured for this repository.");
    }

    const publish = await runGit(repoPath, ["push", "--set-upstream", remoteName, branchName]);
    if (publish.code !== 0) return fail(publish, this.mapNetworkError(publish.stderr));
    return ok(publish);
  }

  async cherryPick(repoPath: string, commitHash: string): Promise<GitOperationResult> {
    const result = await runGit(repoPath, ["cherry-pick", commitHash]);
    if (result.code !== 0) return fail(result, "Cherry-pick failed");
    return ok(result);
  }

  async continueCherryPick(repoPath: string): Promise<GitOperationResult> {
    const result = await runGit(repoPath, ["cherry-pick", "--continue"]);
    if (result.code !== 0) return fail(result, "Cherry-pick continue failed");
    return ok(result);
  }

  async abortCherryPick(repoPath: string): Promise<GitOperationResult> {
    const result = await runGit(repoPath, ["cherry-pick", "--abort"]);
    if (result.code !== 0) return fail(result, "Cherry-pick abort failed");
    return ok(result);
  }

  async revertCommit(repoPath: string, commitHash: string): Promise<GitOperationResult> {
    const result = await runGit(repoPath, ["revert", "--no-edit", commitHash]);
    if (result.code !== 0) return fail(result, "Revert failed");
    return ok(result);
  }

  async listStashes(repoPath: string): Promise<GitStashEntry[]> {
    const SEP = "\x1f";
    const REC = "\x1e";
    const result = await runGit(repoPath, [
      "stash",
      "list",
      `--format=%H${SEP}%P${SEP}%gd${SEP}%cI${SEP}%gs${REC}`
    ]);
    if (result.code !== 0) return [];
    const raw = result.stdout;
    if (!raw.trim()) return [];

    const entries: GitStashEntry[] = [];
    const records = raw.split(REC).map((r) => r.replace(/^\r?\n/, "")).filter((r) => r.length > 0);
    for (const record of records) {
      const fields = record.split(SEP);
      if (fields.length < 5) continue;
      const [hash, parentList, gd, date, subject] = fields;
      const parentHash = (parentList || "").trim().split(/\s+/).filter(Boolean)[0] || "";
      if (!hash || !parentHash) continue;

      const indexMatch = gd.match(/stash@\{(\d+)\}/);
      const index = indexMatch ? Number(indexMatch[1]) : entries.length;

      const subjectMatch = subject.match(/^(?:WIP )?[oO]n (.+?):\s?(.*)$/);
      const branch = subjectMatch ? subjectMatch[1] : "";
      const message = subjectMatch ? subjectMatch[2] : subject;

      entries.push({
        index,
        hash: hash.trim(),
        parentHash,
        message: message.trim(),
        branch,
        dateISO: date.trim()
      });
    }
    return entries;
  }

  async stashPush(repoPath: string, message: string): Promise<GitOperationResult> {
    if (!message.trim()) {
      return { ok: false, code: 1, stdout: "", stderr: "", message: "Stash message cannot be empty." };
    }
    const result = await runGit(repoPath, ["stash", "push", "-u", "-m", message]);
    if (result.code !== 0) return fail(result, "Stash failed");
    const lower = (result.stdout + result.stderr).toLowerCase();
    if (lower.includes("no local changes to save")) {
      return { ok: false, code: 1, stdout: result.stdout, stderr: result.stderr, message: "No local changes to stash." };
    }
    return ok(result);
  }

  async stashPop(repoPath: string, index: number): Promise<GitOperationResult> {
    const result = await runGit(repoPath, ["stash", "pop", "--index", `stash@{${index}}`]);
    if (result.code !== 0) {
      const fallback = result.stderr.toLowerCase().includes("conflict")
        ? "Stash pop produced conflicts. Resolve them and the stash entry was kept."
        : "Stash pop failed";
      return fail(result, fallback);
    }
    return ok(result);
  }

  async stashApply(repoPath: string, index: number): Promise<GitOperationResult> {
    const result = await runGit(repoPath, ["stash", "apply", "--index", `stash@{${index}}`]);
    if (result.code !== 0) return fail(result, "Stash apply failed");
    return ok(result);
  }

  async stashDrop(repoPath: string, index: number): Promise<GitOperationResult> {
    const result = await runGit(repoPath, ["stash", "drop", `stash@{${index}}`]);
    if (result.code !== 0) return fail(result, "Stash drop failed");
    return ok(result);
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
