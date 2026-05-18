import { GitCommit } from "../../shared/types";

const SEP = "\u001f";

export const historyFormat = ["%H", "%h", "%an", "%ae", "%aI", "%s", "%D"].join(SEP);

export function parseHistory(input: string): GitCommit[] {
  return input
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [hash, shortHash, authorName, authorEmail, date, subject, refs] = line.split(SEP);
      return { hash, shortHash, authorName, authorEmail, date, subject, refs: refs ?? "" };
    });
}
