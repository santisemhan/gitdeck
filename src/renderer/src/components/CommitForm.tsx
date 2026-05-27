import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { IconCommit } from "./icons";
import { getCommitDraftStorageKeys } from "../constants/storageKeys";
import { readDraftValue, writeDraftValue } from "../utils/storage";

export interface CommitFormProps {
  repoPath: string;
  stagedCount: number;
  onCommit: (summary: string, description: string) => void;
  height: number;
  onStartResize: (event: ReactMouseEvent<HTMLDivElement>) => void;
}

export function CommitForm({ repoPath, stagedCount, onCommit, height, onStartResize }: CommitFormProps) {
  const storageKeys = useMemo(() => getCommitDraftStorageKeys(repoPath), [repoPath]);
  const [summary, setSummary] = useState(() => readDraftValue(storageKeys.summary));
  const [desc, setDesc] = useState(() => readDraftValue(storageKeys.description));
  const maxLen = 72;
  const remaining = maxLen - summary.length;
  const canCommit = stagedCount > 0 && summary.trim().length > 0;

  useEffect(() => {
    setSummary(readDraftValue(storageKeys.summary));
    setDesc(readDraftValue(storageKeys.description));
  }, [storageKeys]);

  useEffect(() => {
    writeDraftValue(storageKeys.summary, summary);
  }, [storageKeys.summary, summary]);

  useEffect(() => {
    writeDraftValue(storageKeys.description, desc);
  }, [storageKeys.description, desc]);

  const submit = () => {
    if (!canCommit) return;
    onCommit(summary.trim(), desc.trim());
    setSummary("");
    setDesc("");
  };

  return (
    <div className="commit-form-wrap" style={{ height: `${height}px`, flex: `0 0 ${height}px` }}>
      <div className="splitter" title="Drag to resize" onMouseDown={onStartResize} />

      <div className="ftabs">
        <button className="ftab active" title="Commit staged changes">
          <span className="ico">
            <IconCommit size={15} />
          </span>
          Commit
        </button>
      </div>

      <div className="summary">
        <input
          type="text"
          placeholder="Commit summary"
          value={summary}
          maxLength={maxLen + 20}
          onChange={(e) => setSummary(e.target.value)}
        />
        <span className={"counter" + (remaining < 10 ? " danger" : "")}>
          {remaining}
        </span>
      </div>

      <div className="desc">
        <textarea
          rows={2}
          placeholder="Description"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
      </div>

      <button
        className="submit"
        disabled={!canCommit}
        onClick={submit}
        title={!canCommit ? "Stage files and write a summary first" : "Commit staged changes"}
      >
        <IconCommit size={16} />
        {stagedCount > 0 ? `Commit ${stagedCount} file${stagedCount === 1 ? "" : "s"}` : "Stage Changes to Commit"}
      </button>
    </div>
  );
}
