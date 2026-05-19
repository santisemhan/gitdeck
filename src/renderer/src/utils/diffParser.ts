export type DiffLineType = "header" | "hunk" | "context" | "add" | "del";

export interface DiffLine {
  type: DiffLineType;
  leftNumber: string;
  rightNumber: string;
  text: string;
}

export function parseUnifiedDiff(text: string): DiffLine[] {
  const lines = text.split(/\r?\n/);
  const out: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith("diff --git") || line.startsWith("index ") || line.startsWith("--- ") || line.startsWith("+++ ")) {
      out.push({ type: "header", leftNumber: "", rightNumber: "", text: line });
      continue;
    }
    if (line.startsWith("@@")) {
      const m = /@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/.exec(line);
      if (m) {
        oldLine = Number(m[1]);
        newLine = Number(m[2]);
      }
      out.push({ type: "hunk", leftNumber: "", rightNumber: "", text: line });
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      out.push({ type: "add", leftNumber: "", rightNumber: String(newLine), text: line });
      newLine += 1;
      continue;
    }
    if (line.startsWith("-") && !line.startsWith("---")) {
      out.push({ type: "del", leftNumber: String(oldLine), rightNumber: "", text: line });
      oldLine += 1;
      continue;
    }
    out.push({ type: "context", leftNumber: String(oldLine), rightNumber: String(newLine), text: line });
    oldLine += 1;
    newLine += 1;
  }

  return out;
}
