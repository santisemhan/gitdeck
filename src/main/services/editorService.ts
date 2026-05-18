import { EditorOperationResult } from "../../shared/types";
import { runCommand } from "./commandRunner";

export class EditorService {
  async isVSCodeAvailable(): Promise<boolean> {
    const result = await runCommand("code", ["--version"], undefined, 8000);
    return result.code === 0;
  }

  async openFileInVSCode(filePath: string): Promise<EditorOperationResult> {
    const available = await this.isVSCodeAvailable();
    if (!available) {
      return {
        ok: false,
        message: "VS Code CLI not found. Install VS Code and run 'Shell Command: Install code command in PATH'."
      };
    }
    const result = await runCommand("code", [filePath], undefined, 10000);
    return {
      ok: result.code === 0,
      message: result.code === 0 ? "Opened in VS Code" : result.stderr || "Failed to open file"
    };
  }

  async openRepositoryInVSCode(repoPath: string): Promise<EditorOperationResult> {
    const available = await this.isVSCodeAvailable();
    if (!available) {
      return {
        ok: false,
        message: "VS Code CLI not found. Install VS Code and run 'Shell Command: Install code command in PATH'."
      };
    }
    const result = await runCommand("code", [repoPath], undefined, 10000);
    return {
      ok: result.code === 0,
      message: result.code === 0 ? "Repository opened in VS Code" : result.stderr || "Failed to open repository"
    };
  }
}
