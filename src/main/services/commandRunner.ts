import { spawn } from "node:child_process";

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export function runCommand(
  command: string,
  args: string[],
  cwd?: string,
  timeoutMs = 30000
): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill();
      resolve({ code: 124, stdout, stderr: `${stderr}\nCommand timed out after ${timeoutMs}ms.`.trim() });
    }, timeoutMs);

    child.stdout.on("data", (buf) => {
      stdout += buf.toString("utf8");
    });

    child.stderr.on("data", (buf) => {
      stderr += buf.toString("utf8");
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: 127, stdout, stderr: `${stderr}\n${err.message}`.trim() });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout: stdout.trimEnd(), stderr: stderr.trimEnd() });
    });
  });
}
