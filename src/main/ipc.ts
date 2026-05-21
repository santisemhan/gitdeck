import path from "node:path";
import { watch } from "node:fs";
import { dialog, ipcMain } from "electron";
import { Channels } from "../shared/channels";
import { EditorService } from "./services/editorService";
import { GitService } from "./services/gitService";
import { RecentRepoStore } from "./services/recentRepoStore";

interface RepoWatchEntry {
  repoPath: string;
  close: () => void;
}

export function registerIpcHandlers() {
  const gitService = new GitService();
  const editorService = new EditorService();
  const store = new RecentRepoStore();
  const watchesByWindow = new Map<number, RepoWatchEntry>();

  const stopWatching = (windowId: number) => {
    const current = watchesByWindow.get(windowId);
    if (!current) return;
    current.close();
    watchesByWindow.delete(windowId);
  };

  const startWatching = (windowId: number, repoPath: string, emit: () => void) => {
    stopWatching(windowId);
    let timer: NodeJS.Timeout | null = null;
    const queueEmit = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(emit, 180);
    };

    const watchers = [
      watch(repoPath, { recursive: true }, queueEmit),
      watch(path.join(repoPath, ".git"), queueEmit)
    ];

    watchesByWindow.set(windowId, {
      repoPath,
      close: () => {
        if (timer) clearTimeout(timer);
        for (const watcher of watchers) watcher.close();
      }
    });
  };

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

  ipcMain.handle(Channels.watchRepository, (event, repoPath: string) => {
    const win = event.sender;
    const emitChange = () => {
      if (!win.isDestroyed()) {
        win.send(Channels.repositoryChanged, { repoPath, changedAt: Date.now() });
      }
    };

    try {
      startWatching(win.id, repoPath, emitChange);
      if (!win.isDestroyed()) {
        win.once("destroyed", () => stopWatching(win.id));
      }
      return { ok: true };
    } catch (err) {
      stopWatching(win.id);
      const message = err instanceof Error ? err.message : "Unable to watch repository";
      return { ok: false, message };
    }
  });

  ipcMain.handle(Channels.unwatchRepository, (event) => {
    stopWatching(event.sender.id);
    return { ok: true };
  });

  ipcMain.handle(Channels.getStatus, (_e, repoPath: string) => gitService.getStatus(repoPath));
  ipcMain.handle(Channels.getDiff, (_e, repoPath: string, filePath: string, staged: boolean) => gitService.getDiff(repoPath, filePath, staged));
  ipcMain.handle(Channels.stageFile, (_e, repoPath: string, filePath: string) => gitService.stageFile(repoPath, filePath));
  ipcMain.handle(Channels.unstageFile, (_e, repoPath: string, filePath: string) => gitService.unstageFile(repoPath, filePath));
  ipcMain.handle(Channels.stageAll, (_e, repoPath: string) => gitService.stageAll(repoPath));
  ipcMain.handle(Channels.unstageAll, (_e, repoPath: string) => gitService.unstageAll(repoPath));
  ipcMain.handle(Channels.discardAll, (_e, repoPath: string) => gitService.discardAll(repoPath));
  ipcMain.handle(Channels.commit, (_e, repoPath: string, message: string) => gitService.commit(repoPath, message));
  ipcMain.handle(Channels.getHistory, (_e, repoPath: string) => gitService.getHistory(repoPath));
  ipcMain.handle(Channels.getCommitDetails, (_e, repoPath: string, hash: string) => gitService.getCommitDetails(repoPath, hash));
  ipcMain.handle(Channels.getCommitFileDiff, (_e, repoPath: string, hash: string, filePath: string) => gitService.getCommitFileDiff(repoPath, hash, filePath));
  ipcMain.handle(Channels.getFileContent, (_e, repoPath: string, filePath: string, source: string, commitHash?: string) => gitService.getFileContent(repoPath, filePath, source as "unstaged" | "staged" | "commit", commitHash));
  ipcMain.handle(Channels.getSplitContent, (_e, repoPath: string, filePath: string, source: string, commitHash?: string) => gitService.getSplitContent(repoPath, filePath, source as "unstaged" | "staged" | "commit", commitHash));
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
