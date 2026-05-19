import { GitCommit } from "../../shared/types";

const SEP = "";
const REC = "";

export const historyFormat = ["%H", "%h", "%an", "%ae", "%aI", "%s", "%D", "%P", "%b"].join(SEP) + REC;

export function parseHistory(input: string): GitCommit[] {
  return input
    .split(REC)
    .map((entry) => entry.replace(/^\r?\n/, ""))
    .filter(Boolean)
    .map((entry) => {
      const [hash, shortHash, authorName, authorEmail, date, subject, refs, parents, body] = entry.split(SEP);
      return {
        hash,
        shortHash,
        authorName,
        authorEmail,
        date,
        subject,
        refs: refs ?? "",
        parents: (parents ?? "").trim().split(/\s+/).filter(Boolean),
        body: (body ?? "").replace(/\r?\n$/, "")
      };
    });
}
