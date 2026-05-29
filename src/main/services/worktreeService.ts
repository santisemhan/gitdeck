import fs from "node:fs";
import path from "node:path";
import { simpleGit } from "simple-git";
import { GitOperationResult, WorktreeInfo } from "../../shared/types";

type CommandResult = { code: number; stdout: string; stderr: string };

function fail(result: CommandResult, fallback: string): GitOperationResult {
  return { ok: false, code: result.code, stdout: result.stdout, stderr: result.stderr, message: result.stderr || fallback };
}

function ok(result: CommandResult): GitOperationResult {
  return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
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

export class WorktreeService {
  async listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
    const result = await runGit(repoPath, ["worktree", "list", "--porcelain"]);
    if (result.code !== 0) return [];

    const worktrees: WorktreeInfo[] = [];
    const lines = result.stdout.split("\n");
    let current: Partial<WorktreeInfo> = {};

    for (const line of lines) {
      if (line.startsWith("worktree ")) {
        if (current.path) {
          worktrees.push(this.finalizeWorktree(current, repoPath));
        }
        current = { path: line.substring("worktree ".length).trim() };
      } else if (line.startsWith("HEAD ")) {
        current.branch = undefined;
      } else if (line.startsWith("branch ")) {
        const branchRef = line.substring("branch ".length).trim();
        current.branch = branchRef.replace("refs/heads/", "");
      } else if (line === "detached") {
        current.branch = "(detached)";
      } else if (line === "") {
        if (current.path) {
          worktrees.push(this.finalizeWorktree(current, repoPath));
          current = {};
        }
      }
    }

    if (current.path) {
      worktrees.push(this.finalizeWorktree(current, repoPath));
    }

    return worktrees;
  }

  private finalizeWorktree(partial: Partial<WorktreeInfo>, repoPath: string): WorktreeInfo {
    const worktreePath = partial.path || "";
    const isMain = worktreePath === repoPath;
    const isOrphaned = !fs.existsSync(worktreePath);
    const hasChanges = !isOrphaned && this.checkHasChanges(worktreePath);

    return {
      path: worktreePath,
      branch: partial.branch || "(unknown)",
      isMain,
      isOrphaned,
      hasChanges
    };
  }

  private checkHasChanges(worktreePath: string): boolean {
    try {
      const gitDir = path.join(worktreePath, ".git");
      if (!fs.existsSync(gitDir)) return false;

      const stat = fs.statSync(gitDir);
      if (stat.isFile()) {
        const gitFileContent = fs.readFileSync(gitDir, "utf-8");
        const match = gitFileContent.match(/gitdir: (.+)/);
        if (match) {
          const gitDirPath = match[1].trim();
          const indexFile = path.join(gitDirPath, "index");
          if (fs.existsSync(indexFile)) {
            const indexStat = fs.statSync(indexFile);
            return indexStat.size > 0;
          }
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  async createWorktree(repoPath: string, branch: string, targetPath: string): Promise<GitOperationResult> {
    if (fs.existsSync(targetPath)) {
      return { ok: false, code: 1, stdout: "", stderr: "Path already exists", message: "Path already exists" };
    }

    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      try {
        fs.mkdirSync(parentDir, { recursive: true });
      } catch {
        return { ok: false, code: 1, stdout: "", stderr: "Failed to create parent directory", message: "Failed to create parent directory" };
      }
    }

    const result = await runGit(repoPath, ["worktree", "add", targetPath, branch]);
    return result.code === 0 ? ok(result) : fail(result, "Failed to create worktree");
  }

  async deleteWorktree(repoPath: string, worktreePath: string): Promise<GitOperationResult> {
    const result = await runGit(repoPath, ["worktree", "remove", worktreePath, "--force"]);
    return result.code === 0 ? ok(result) : fail(result, "Failed to delete worktree");
  }

  async moveWorktree(repoPath: string, oldPath: string, newPath: string): Promise<GitOperationResult> {
    if (fs.existsSync(newPath)) {
      return { ok: false, code: 1, stdout: "", stderr: "Target path already exists", message: "Target path already exists" };
    }

    const result = await runGit(repoPath, ["worktree", "move", oldPath, newPath]);
    return result.code === 0 ? ok(result) : fail(result, "Failed to move worktree");
  }

  async pruneWorktree(repoPath: string, worktreePath: string): Promise<GitOperationResult> {
    const result = await runGit(repoPath, ["worktree", "prune"]);
    return result.code === 0 ? ok(result) : fail(result, "Failed to prune worktree");
  }

  async openInFinder(worktreePath: string): Promise<GitOperationResult> {
    if (!fs.existsSync(worktreePath)) {
      return { ok: false, code: 1, stdout: "", stderr: "Path does not exist", message: "Path does not exist" };
    }

    try {
      const { exec } = await import("node:child_process");
      const platform = process.platform;
      const cmd = platform === "darwin" ? "open" : platform === "win32" ? "explorer" : "xdg-open";
      await new Promise<void>((resolve, reject) => {
        exec(`${cmd} "${worktreePath}"`, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      return { ok: true, code: 0, stdout: "", stderr: "" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to open in Finder";
      return { ok: false, code: 1, stdout: "", stderr: message, message };
    }
  }

  async switchToWorktree(worktreePath: string): Promise<GitOperationResult> {
    if (!fs.existsSync(worktreePath)) {
      return { ok: false, code: 1, stdout: "", stderr: "Path does not exist", message: "Path does not exist" };
    }

    return { ok: true, code: 0, stdout: worktreePath, stderr: "" };
  }
}
