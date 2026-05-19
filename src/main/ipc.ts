import path from "node:path";
import { dialog, ipcMain } from "electron";
import { Channels } from "../shared/channels";
import { EditorService } from "./services/editorService";
import { GitService } from "./services/gitService";
import { RecentRepoStore } from "./services/recentRepoStore";

export function registerIpcHandlers() {
  const gitService = new GitService();
  const editorService = new EditorService();
  const store = new RecentRepoStore();

  ipcMain.handle(Channels.selectRepository, async () => {
    const picked = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (picked.canceled || picked.filePaths.length === 0) return { ok: false, message: "No folder selected" };
    const repoPath = picked.filePaths[0];
    const validation = await gitService.validateRepository(repoPath);
    if (!validation.ok) return validation;
    store.add(repoPath);
    return { ok: true, path: repoPath, name: path.basename(repoPath) };
  });

  ipcMain.handle(Channels.getRecentRepositories, () => store.getAll());

  ipcMain.handle(Channels.getStatus, (_e, repoPath: string) => gitService.getStatus(repoPath));
  ipcMain.handle(Channels.getDiff, (_e, repoPath: string, filePath: string, staged: boolean) => gitService.getDiff(repoPath, filePath, staged));
  ipcMain.handle(Channels.stageFile, (_e, repoPath: string, filePath: string) => gitService.stageFile(repoPath, filePath));
  ipcMain.handle(Channels.unstageFile, (_e, repoPath: string, filePath: string) => gitService.unstageFile(repoPath, filePath));
  ipcMain.handle(Channels.stageAll, (_e, repoPath: string) => gitService.stageAll(repoPath));
  ipcMain.handle(Channels.unstageAll, (_e, repoPath: string) => gitService.unstageAll(repoPath));
  ipcMain.handle(Channels.commit, (_e, repoPath: string, message: string) => gitService.commit(repoPath, message));
  ipcMain.handle(Channels.getHistory, (_e, repoPath: string) => gitService.getHistory(repoPath));
  ipcMain.handle(Channels.getCommitDetails, (_e, repoPath: string, hash: string) => gitService.getCommitDetails(repoPath, hash));
  ipcMain.handle(Channels.getBranches, (_e, repoPath: string) => gitService.getBranches(repoPath));
  ipcMain.handle(Channels.checkoutBranch, (_e, repoPath: string, name: string) => gitService.checkoutBranch(repoPath, name));
  ipcMain.handle(Channels.checkoutRemoteBranch, (_e, repoPath: string, remoteBranch: string) => gitService.checkoutRemoteBranch(repoPath, remoteBranch));
  ipcMain.handle(Channels.createBranch, (_e, repoPath: string, name: string, startPoint?: string) => gitService.createBranch(repoPath, name, startPoint));
  ipcMain.handle(Channels.pull, (_e, repoPath: string) => gitService.pull(repoPath));
  ipcMain.handle(Channels.push, (_e, repoPath: string) => gitService.push(repoPath));
  ipcMain.handle(Channels.cherryPick, (_e, repoPath: string, hash: string) => gitService.cherryPick(repoPath, hash));
  ipcMain.handle(Channels.continueCherryPick, (_e, repoPath: string) => gitService.continueCherryPick(repoPath));
  ipcMain.handle(Channels.abortCherryPick, (_e, repoPath: string) => gitService.abortCherryPick(repoPath));

  ipcMain.handle(Channels.isVSCodeAvailable, () => editorService.isVSCodeAvailable());
  ipcMain.handle(Channels.openFileInVSCode, (_e, filePath: string) => editorService.openFileInVSCode(filePath));
  ipcMain.handle(Channels.openRepoInVSCode, (_e, repoPath: string) => editorService.openRepositoryInVSCode(repoPath));
}
