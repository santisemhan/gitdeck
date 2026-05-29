const COMMIT_DRAFT_NAMESPACE = "gitdeck.commitDraft";
const UI_NAMESPACE = "gitdeck.ui";

export const STORAGE_KEYS = {
  lastRepoPath: "gitdeck:lastRepo",
  openRepos: "gitdeck:openRepos",
  rightPanelUnstagedHeight: `${UI_NAMESPACE}.rightPanel.unstagedHeight`,
  rightPanelCommitHeight: `${UI_NAMESPACE}.rightPanel.commitHeight`,
  commitGraphLabelsWidth: `${UI_NAMESPACE}.commitGraph.labelsWidth`,
  commitGraphWidth: `${UI_NAMESPACE}.commitGraph.graphWidth`,
  commitGraphShowLabels: `${UI_NAMESPACE}.commitGraph.showLabels`,
  commitGraphShowMessage: `${UI_NAMESPACE}.commitGraph.showMessage`,
  commitGraphShowDate: `${UI_NAMESPACE}.commitGraph.showDate`,
  commitGraphDateWidth: `${UI_NAMESPACE}.commitGraph.dateWidth`,
  leftPanelCollapsed: `${UI_NAMESPACE}.leftPanel.collapsed`,
  rightPanelCollapsed: `${UI_NAMESPACE}.rightPanel.collapsed`,
  leftPanelWidth: `${UI_NAMESPACE}.leftPanel.width`,
  rightPanelWidth: `${UI_NAMESPACE}.rightPanel.width`,
} as const;

function normalizeRepoPath(repoPath: string): string {
  return repoPath.trim().replace(/\\/g, "/").toLowerCase();
}

export function getCommitDraftStorageKeys(repoPath: string): {
  summary: string;
  description: string;
} {
  const scope = encodeURIComponent(normalizeRepoPath(repoPath));
  return {
    summary: `${COMMIT_DRAFT_NAMESPACE}.${scope}.summary`,
    description: `${COMMIT_DRAFT_NAMESPACE}.${scope}.description`,
  };
}
