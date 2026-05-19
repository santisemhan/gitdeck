export const Channels = {
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
  getCommitFileDiff: "git:commitFileDiff",
  getFileContent: "git:fileContent",
  getBranches: "git:branches",
  checkoutBranch: "git:checkoutBranch",
  checkoutRemoteBranch: "git:checkoutRemoteBranch",
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
