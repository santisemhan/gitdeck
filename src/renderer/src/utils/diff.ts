export type DiffLineKind = "ctx" | "add" | "del";

export interface DiffHunkLine {
  kind: DiffLineKind;
  oldLn: number | null;
  newLn: number | null;
  text: string;
}

export interface DiffHunk {
  header: string;
  lines: DiffHunkLine[];
}

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function parseUnifiedDiff(text: string): DiffHunk[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const hunks: DiffHunk[] = [];
  let current: DiffHunk | null = null;
  let oldLn = 0;
  let newLn = 0;
  let inBody = false;

  for (const line of lines) {
    const match = line.match(HUNK_HEADER);
    if (match) {
      if (current) hunks.push(current);
      oldLn = Number(match[1]);
      newLn = Number(match[2]);
      current = { header: line.slice(0, line.lastIndexOf("@@") + 2), lines: [] };
      inBody = true;
      continue;
    }
    if (!inBody || !current) continue;
    if (line.startsWith("\\ ")) continue;
    const head = line.charAt(0);
    const rest = line.slice(1);
    if (head === "+") {
      current.lines.push({ kind: "add", oldLn: null, newLn, text: rest });
      newLn++;
    } else if (head === "-") {
      current.lines.push({ kind: "del", oldLn, newLn: null, text: rest });
      oldLn++;
    } else if (head === " ") {
      current.lines.push({ kind: "ctx", oldLn, newLn, text: rest });
      oldLn++;
      newLn++;
    } else if (line === "") {
      current.lines.push({ kind: "ctx", oldLn, newLn, text: "" });
      oldLn++;
      newLn++;
    } else {
      inBody = false;
    }
  }
  if (current) hunks.push(current);
  return hunks;
}

export function parseDiff(oldText: string, newText: string): DiffHunk[] {
  const oldLines = (oldText || "").split("\n");
  const newLines = (newText || "").split("\n");

  if (oldLines[oldLines.length - 1] === "") oldLines.pop();
  if (newLines[newLines.length - 1] === "") newLines.pop();

  function buildLCS(a: string[], b: string[]): Int32Array[] {
    const m = a.length;
    const n = b.length;
    const dp: Int32Array[] = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    return dp;
  }

  function rawDiff(a: string[], b: string[]): { type: DiffLineKind; text: string }[] {
    if (a.length === 0 && b.length === 0) return [];
    if (a.length === 0) return b.map((l) => ({ type: "add" as const, text: l }));
    if (b.length === 0) return a.map((l) => ({ type: "del" as const, text: l }));

    const dp = buildLCS(a, b);
    const result: { type: DiffLineKind; text: string }[] = [];
    let i = 0;
    let j = 0;
    while (i < a.length || j < b.length) {
      if (i < a.length && j < b.length && a[i] === b[j]) {
        result.push({ type: "ctx", text: b[j] });
        i++;
        j++;
      } else if (j < b.length && (i >= a.length || dp[i][j + 1] >= dp[i + 1][j])) {
        result.push({ type: "add", text: b[j] });
        j++;
      } else {
        result.push({ type: "del", text: a[i] });
        i++;
      }
    }
    return result;
  }

  const raw = rawDiff(oldLines, newLines);

  const CTX = 3;
  const ctxIdx = raw
    .map((l, i) => ({ ...l, rawIdx: i }))
    .filter((l) => l.type !== "ctx")
    .flatMap((l) => {
      const start = Math.max(0, l.rawIdx - CTX);
      const end = Math.min(raw.length - 1, l.rawIdx + CTX);
      return Array.from({ length: end - start + 1 }, (_, k) => start + k);
    });
  const visibleSet = new Set(ctxIdx);

  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let oldLn = 1;
  let newLn = 1;

  for (let idx = 0; idx < raw.length; idx++) {
    const line = raw[idx];
    if (!visibleSet.has(idx)) {
      if (currentHunk) {
        hunks.push(currentHunk);
        currentHunk = null;
      }
      if (line.type === "ctx") {
        oldLn++;
        newLn++;
      } else if (line.type === "del") {
        oldLn++;
      } else {
        newLn++;
      }
      continue;
    }
    if (!currentHunk) {
      currentHunk = { header: `@@ -${oldLn} +${newLn} @@`, lines: [] };
    }
    if (line.type === "ctx") {
      currentHunk.lines.push({ kind: "ctx", oldLn, newLn, text: line.text });
      oldLn++;
      newLn++;
    } else if (line.type === "del") {
      currentHunk.lines.push({ kind: "del", oldLn, newLn: null, text: line.text });
      oldLn++;
    } else {
      currentHunk.lines.push({ kind: "add", oldLn: null, newLn, text: line.text });
      newLn++;
    }
  }
  if (currentHunk) hunks.push(currentHunk);

  if (oldText === "" && hunks.length === 0 && newLines.length > 0) {
    let ln = 1;
    const hunk: DiffHunk = { header: "@@ -0,0 +1 @@", lines: [] };
    newLines.forEach((t) => {
      hunk.lines.push({ kind: "add", oldLn: null, newLn: ln++, text: t });
    });
    hunks.push(hunk);
  }

  return hunks;
}

const KEYWORDS =
  /\b(using|namespace|public|private|protected|internal|class|record|abstract|sealed|static|async|await|override|virtual|new|return|var|readonly|const|void|string|int|bool|Task|IActionResult|HttpContext|get|set|if|else|for|foreach|in|out|ref|true|false|null|this|base)\b/g;
const STRINGS = /(["'`])(?:[^\\]|\\.)*?\1/g;
const COMMENTS = /(\/\/.*|\/\*[\s\S]*?\*\/|#.*)/g;
const NUMBERS = /\b(\d+(\.\d+)?)\b/g;
const TYPES = /\b([A-Z][A-Za-z0-9]*)\b/g;

export function tokenize(text: string): string {
  let s = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  s = s.replace(COMMENTS, '<span class="tok-c">$1</span>');
  s = s.replace(STRINGS, '<span class="tok-s">$&</span>');
  s = s.replace(KEYWORDS, '<span class="tok-k">$&</span>');
  s = s.replace(NUMBERS, '<span class="tok-n">$&</span>');
  s = s.replace(TYPES, '<span class="tok-t">$&</span>');
  return s;
}
