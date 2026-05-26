const COMMIT_DRAFT_NAMESPACE = "gitdeck.commitDraft";

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
