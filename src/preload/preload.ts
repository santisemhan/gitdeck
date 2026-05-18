import { contextBridge, ipcRenderer } from "electron";

const Channels = {
  selectRepository: "repo:select",
  getRecentRepositories: "repo:recent",

  getStatus: "git:status",
  getDiff: "git:diff",
  stageFile: "git:stageFile",
  unstageFile: "git:unstageFile",
  stageAll: "git:stageAll",
  unstageAll: "git:unstageAll",
  commit: "git:commit",
  getHistory: "git:history",
  getCommitDetails: "git:commitDetails",
  getBranches: "git:branches",
  checkoutBranch: "git:checkoutBranch",
  createBranch: "git:createBranch",
  pull: "git:pull",
  push: "git:push",
  cherryPick: "git:cherryPick",
  continueCherryPick: "git:continueCherryPick",
  abortCherryPick: "git:abortCherryPick",

  isVSCodeAvailable: "editor:isVSCodeAvailable",
  openFileInVSCode: "editor:openFileInVSCode",
  openRepoInVSCode: "editor:openRepoInVSCode"
} as const;

contextBridge.exposeInMainWorld("gitdeck", {
  selectRepository: () => ipcRenderer.invoke(Channels.selectRepository),
  getRecentRepositories: () => ipcRenderer.invoke(Channels.getRecentRepositories),

  getStatus: (repoPath: string) => ipcRenderer.invoke(Channels.getStatus, repoPath),
  getDiff: (repoPath: string, filePath: string, staged: boolean) => ipcRenderer.invoke(Channels.getDiff, repoPath, filePath, staged),
  stageFile: (repoPath: string, filePath: string) => ipcRenderer.invoke(Channels.stageFile, repoPath, filePath),
  unstageFile: (repoPath: string, filePath: string) => ipcRenderer.invoke(Channels.unstageFile, repoPath, filePath),
  stageAll: (repoPath: string) => ipcRenderer.invoke(Channels.stageAll, repoPath),
  unstageAll: (repoPath: string) => ipcRenderer.invoke(Channels.unstageAll, repoPath),
  commit: (repoPath: string, message: string) => ipcRenderer.invoke(Channels.commit, repoPath, message),
  getHistory: (repoPath: string) => ipcRenderer.invoke(Channels.getHistory, repoPath),
  getCommitDetails: (repoPath: string, commitHash: string) => ipcRenderer.invoke(Channels.getCommitDetails, repoPath, commitHash),
  getBranches: (repoPath: string) => ipcRenderer.invoke(Channels.getBranches, repoPath),
  checkoutBranch: (repoPath: string, branch: string) => ipcRenderer.invoke(Channels.checkoutBranch, repoPath, branch),
  createBranch: (repoPath: string, branch: string, startPoint?: string) => ipcRenderer.invoke(Channels.createBranch, repoPath, branch, startPoint),
  pull: (repoPath: string) => ipcRenderer.invoke(Channels.pull, repoPath),
  push: (repoPath: string) => ipcRenderer.invoke(Channels.push, repoPath),
  cherryPick: (repoPath: string, commitHash: string) => ipcRenderer.invoke(Channels.cherryPick, repoPath, commitHash),
  continueCherryPick: (repoPath: string) => ipcRenderer.invoke(Channels.continueCherryPick, repoPath),
  abortCherryPick: (repoPath: string) => ipcRenderer.invoke(Channels.abortCherryPick, repoPath),

  isVSCodeAvailable: () => ipcRenderer.invoke(Channels.isVSCodeAvailable),
  openFileInVSCode: (filePath: string) => ipcRenderer.invoke(Channels.openFileInVSCode, filePath),
  openRepositoryInVSCode: (repoPath: string) => ipcRenderer.invoke(Channels.openRepoInVSCode, repoPath)
});
