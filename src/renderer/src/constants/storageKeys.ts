const COMMIT_DRAFT_NAMESPACE = "gitdeck.commitDraft";
const UI_NAMESPACE = "gitdeck.ui";

export const STORAGE_KEYS = {
  lastRepoPath: "gitdeck:lastRepo",
  openRepos: "gitdeck:openRepos",
  rightPanelUnstagedHeight: `${UI_NAMESPACE}.rightPanel.unstagedHeight`,
  rightPanelCommitHeight: `${UI_NAMESPACE}.rightPanel.commitHeight`,
  commitGraphLabelsWidth: `${UI_NAMESPACE}.commitGraph.labelsWidth`,
  commitGraphWidth: `${UI_NAMESPACE}.commitGraph.graphWidth`,
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
