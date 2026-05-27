import { contextBridge, ipcRenderer } from "electron";
import { Channels } from "../shared/channels";

contextBridge.exposeInMainWorld("gitdeck", {
  selectRepository: () => ipcRenderer.invoke(Channels.selectRepository),
  getRecentRepositories: () => ipcRenderer.invoke(Channels.getRecentRepositories),

  getStatus: (repoPath: string) => ipcRenderer.invoke(Channels.getStatus, repoPath),
  getDiff: (repoPath: string, filePath: string, staged: boolean) => ipcRenderer.invoke(Channels.getDiff, repoPath, filePath, staged),
  stageFile: (repoPath: string, filePath: string) => ipcRenderer.invoke(Channels.stageFile, repoPath, filePath),
  unstageFile: (repoPath: string, filePath: string) => ipcRenderer.invoke(Channels.unstageFile, repoPath, filePath),
  stageAll: (repoPath: string) => ipcRenderer.invoke(Channels.stageAll, repoPath),
  unstageAll: (repoPath: string) => ipcRenderer.invoke(Channels.unstageAll, repoPath),
  discardAll: (repoPath: string) => ipcRenderer.invoke(Channels.discardAll, repoPath),
  commit: (repoPath: string, message: string) => ipcRenderer.invoke(Channels.commit, repoPath, message),
  getHistory: (repoPath: string, opts?: { limit?: number; skip?: number }) => ipcRenderer.invoke(Channels.getHistory, repoPath, opts),
  getFileHistory: (repoPath: string, filePath: string, opts?: { limit?: number; skip?: number }) => ipcRenderer.invoke(Channels.getFileHistory, repoPath, filePath, opts),
  getCommitDetails: (repoPath: string, commitHash: string) => ipcRenderer.invoke(Channels.getCommitDetails, repoPath, commitHash),
  getCommitFileDiff: (repoPath: string, commitHash: string, filePath: string) => ipcRenderer.invoke(Channels.getCommitFileDiff, repoPath, commitHash, filePath),
  getFileContent: (repoPath: string, filePath: string, source: string, commitHash?: string) => ipcRenderer.invoke(Channels.getFileContent, repoPath, filePath, source, commitHash),
  getSplitContent: (repoPath: string, filePath: string, source: string, commitHash?: string) => ipcRenderer.invoke(Channels.getSplitContent, repoPath, filePath, source, commitHash),
  getBranches: (repoPath: string) => ipcRenderer.invoke(Channels.getBranches, repoPath),
  checkoutBranch: (repoPath: string, branch: string) => ipcRenderer.invoke(Channels.checkoutBranch, repoPath, branch),
  checkoutRemoteBranch: (repoPath: string, remoteBranch: string) => ipcRenderer.invoke(Channels.checkoutRemoteBranch, repoPath, remoteBranch),
  createBranch: (repoPath: string, branch: string, startPoint?: string) => ipcRenderer.invoke(Channels.createBranch, repoPath, branch, startPoint),
  deleteBranch: (repoPath: string, name: string) => ipcRenderer.invoke(Channels.deleteBranch, repoPath, name),
  renameBranch: (repoPath: string, oldName: string, newName: string) => ipcRenderer.invoke(Channels.renameBranch, repoPath, oldName, newName),
  pull: (repoPath: string) => ipcRenderer.invoke(Channels.pull, repoPath),
  push: (repoPath: string) => ipcRenderer.invoke(Channels.push, repoPath),
  cherryPick: (repoPath: string, commitHash: string) => ipcRenderer.invoke(Channels.cherryPick, repoPath, commitHash),
  continueCherryPick: (repoPath: string) => ipcRenderer.invoke(Channels.continueCherryPick, repoPath),
  abortCherryPick: (repoPath: string) => ipcRenderer.invoke(Channels.abortCherryPick, repoPath),
  revertCommit: (repoPath: string, hash: string) => ipcRenderer.invoke(Channels.revertCommit, repoPath, hash),
  stashList: (repoPath: string) => ipcRenderer.invoke(Channels.stashList, repoPath),
  stashPush: (repoPath: string, message: string) => ipcRenderer.invoke(Channels.stashPush, repoPath, message),
  stashPop: (repoPath: string, index: number) => ipcRenderer.invoke(Channels.stashPop, repoPath, index),
  stashApply: (repoPath: string, index: number) => ipcRenderer.invoke(Channels.stashApply, repoPath, index),
  stashDrop: (repoPath: string, index: number) => ipcRenderer.invoke(Channels.stashDrop, repoPath, index),
  watchRepository: (repoPath: string) => ipcRenderer.invoke(Channels.watchRepository, repoPath),
  unwatchRepository: () => ipcRenderer.invoke(Channels.unwatchRepository),
  onRepositoryChanged: (listener: (event: { repoPath: string; changedAt: number }) => void) => {
    const handler = (_event: unknown, payload: { repoPath: string; changedAt: number }) => listener(payload);
    ipcRenderer.on(Channels.repositoryChanged, handler);
    return () => ipcRenderer.off(Channels.repositoryChanged, handler);
  },

  isVSCodeAvailable: () => ipcRenderer.invoke(Channels.isVSCodeAvailable),
  openFileInVSCode: (filePath: string) => ipcRenderer.invoke(Channels.openFileInVSCode, filePath),
  openRepositoryInVSCode: (repoPath: string) => ipcRenderer.invoke(Channels.openRepoInVSCode, repoPath),
  terminalCreate: (repoPath: string, cols: number, rows: number) => ipcRenderer.invoke(Channels.terminalCreate, repoPath, cols, rows),
  terminalInput: (sessionId: string, data: string) => ipcRenderer.invoke(Channels.terminalInput, sessionId, data),
  terminalResize: (sessionId: string, cols: number, rows: number) => ipcRenderer.invoke(Channels.terminalResize, sessionId, cols, rows),
  terminalClose: (sessionId: string) => ipcRenderer.invoke(Channels.terminalClose, sessionId),
  onTerminalData: (listener: (event: { sessionId: string; data: string }) => void) => {
    const handler = (_event: unknown, payload: { sessionId: string; data: string }) => listener(payload);
    ipcRenderer.on(Channels.terminalData, handler);
    return () => ipcRenderer.off(Channels.terminalData, handler);
  },
  onTerminalExit: (listener: (event: { sessionId: string; exitCode: number }) => void) => {
    const handler = (_event: unknown, payload: { sessionId: string; exitCode: number }) => listener(payload);
    ipcRenderer.on(Channels.terminalExit, handler);
    return () => ipcRenderer.off(Channels.terminalExit, handler);
  }
});
