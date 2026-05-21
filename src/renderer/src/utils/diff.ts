export type DiffLineKind = "ctx" | "add" | "del";

export interface DiffHunkLine {
  kind: DiffLineKind;
  oldLn: number | null;
  newLn: number | null;
  text: string;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  newStart: number;
  lines: DiffHunkLine[];
}

export interface SplitDiffRow {
  leftLn: number | null;
  rightLn: number | null;
  leftText: string;
  rightText: string;
  leftKind: "ctx" | "del" | "empty";
  rightKind: "ctx" | "add" | "empty";
}

interface RawDiffEntry {
  type: DiffLineKind;
  text: string;
}

interface SplitBlockRow {
  leftText: string;
  rightText: string;
  leftKind: "del" | "empty";
  rightKind: "add" | "empty";
}

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

function rawDiff(a: string[], b: string[]): RawDiffEntry[] {
  if (a.length === 0 && b.length === 0) return [];
  if (a.length === 0) return b.map((l) => ({ type: "add" as const, text: l }));
  if (b.length === 0) return a.map((l) => ({ type: "del" as const, text: l }));

  const dp = buildLCS(a, b);
  const result: RawDiffEntry[] = [];
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

function tokenizeForSimilarity(line: string): string[] {
  return line
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter(Boolean);
}

function lineSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const aa = a.trim();
  const bb = b.trim();
  if (!aa && !bb) return 1;
  if (!aa || !bb) return 0;

  const at = tokenizeForSimilarity(aa);
  const bt = tokenizeForSimilarity(bb);
  if (at.length === 0 || bt.length === 0) return 0;

  const bCount = new Map<string, number>();
  for (const token of bt) bCount.set(token, (bCount.get(token) ?? 0) + 1);

  let overlap = 0;
  for (const token of at) {
    const count = bCount.get(token) ?? 0;
    if (count > 0) {
      overlap++;
      bCount.set(token, count - 1);
    }
  }

  const tokenScore = (2 * overlap) / (at.length + bt.length);
  const lengthScore = 1 - Math.min(Math.abs(aa.length - bb.length) / Math.max(aa.length, bb.length), 1);
  return tokenScore * 0.85 + lengthScore * 0.15;
}

function alignSplitBlock(dels: string[], adds: string[]): SplitBlockRow[] {
  if (dels.length === 0 && adds.length === 0) return [];

  const n = dels.length;
  const m = adds.length;

  if (n * m > 14_400) {
    const len = Math.max(n, m);
    const fallback: SplitBlockRow[] = [];
    for (let i = 0; i < len; i++) {
      fallback.push({
        leftText: dels[i] ?? "",
        rightText: adds[i] ?? "",
        leftKind: i < n ? "del" : "empty",
        rightKind: i < m ? "add" : "empty"
      });
    }
    return fallback;
  }

  const GAP_COST = 0.45;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) dp[i][m] = dp[i + 1][m] + GAP_COST;
  for (let j = m - 1; j >= 0; j--) dp[n][j] = dp[n][j + 1] + GAP_COST;

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const sim = lineSimilarity(dels[i], adds[j]);
      const pairCost = dp[i + 1][j + 1] + (1 - sim);
      const delCost = dp[i + 1][j] + GAP_COST;
      const addCost = dp[i][j + 1] + GAP_COST;
      dp[i][j] = Math.min(pairCost, delCost, addCost);
    }
  }

  const rows: SplitBlockRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i >= n) {
      rows.push({ leftText: "", rightText: adds[j], leftKind: "empty", rightKind: "add" });
      j++;
      continue;
    }
    if (j >= m) {
      rows.push({ leftText: dels[i], rightText: "", leftKind: "del", rightKind: "empty" });
      i++;
      continue;
    }

    const sim = lineSimilarity(dels[i], adds[j]);
    const pairCost = dp[i + 1][j + 1] + (1 - sim);
    const delCost = dp[i + 1][j] + GAP_COST;
    const addCost = dp[i][j + 1] + GAP_COST;
    const best = dp[i][j];

    if (Math.abs(pairCost - best) < 1e-9 || (pairCost <= delCost && pairCost <= addCost)) {
      rows.push({ leftText: dels[i], rightText: adds[j], leftKind: "del", rightKind: "add" });
      i++;
      j++;
    } else if (Math.abs(delCost - best) < 1e-9 || delCost <= addCost) {
      rows.push({ leftText: dels[i], rightText: "", leftKind: "del", rightKind: "empty" });
      i++;
    } else {
      rows.push({ leftText: "", rightText: adds[j], leftKind: "empty", rightKind: "add" });
      j++;
    }
  }

  return rows;
}

function pairUnmatchedRows(rows: SplitDiffRow[]): SplitDiffRow[] {
  const out = rows.map((row) => ({ ...row }));
  const addPool: number[] = [];

  for (let i = 0; i < out.length; i++) {
    const row = out[i];
    if (row.leftKind === "empty" && row.rightKind === "add") addPool.push(i);
  }

  const usedAdd = new Set<number>();
  let poolCursor = 0;

  for (let i = 0; i < out.length; i++) {
    const row = out[i];
    if (!(row.leftKind === "del" && row.rightKind === "empty")) continue;

    let bestIdx = -1;
    let bestScore = 0;

    while (poolCursor < addPool.length && addPool[poolCursor] < i - 140) poolCursor++;

    for (let p = poolCursor; p < addPool.length; p++) {
      const candidateIdx = addPool[p];
      if (candidateIdx > i + 180) break;
      if (usedAdd.has(candidateIdx)) continue;

      const candidate = out[candidateIdx];
      if (!(candidate.leftKind === "empty" && candidate.rightKind === "add")) continue;

      const sim = lineSimilarity(row.leftText, candidate.rightText);
      if (sim > bestScore) {
        bestScore = sim;
        bestIdx = candidateIdx;
      }
    }

    if (bestIdx === -1 || bestScore < 0.38) continue;

    const source = out[bestIdx];
    row.rightKind = "add";
    row.rightText = source.rightText;
    row.rightLn = source.rightLn;

    source.rightKind = "empty";
    source.rightText = "";
    source.rightLn = null;
    usedAdd.add(bestIdx);
  }

  return out;
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
      current = {
        header: line.slice(0, line.lastIndexOf("@@") + 2),
        oldStart: oldLn,
        newStart: newLn,
        lines: []
      };
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
      currentHunk = { header: `@@ -${oldLn} +${newLn} @@`, oldStart: oldLn, newStart: newLn, lines: [] };
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
    const hunk: DiffHunk = { header: "@@ -0,0 +1 @@", oldStart: 0, newStart: 1, lines: [] };
    newLines.forEach((t) => {
      hunk.lines.push({ kind: "add", oldLn: null, newLn: ln++, text: t });
    });
    hunks.push(hunk);
  }

  return hunks;
}

export function buildSplitRows(oldText: string, newText: string): SplitDiffRow[] {
  const oldLines = (oldText || "").split(/\r?\n/);
  const newLines = (newText || "").split(/\r?\n/);
  if (oldLines[oldLines.length - 1] === "") oldLines.pop();
  if (newLines[newLines.length - 1] === "") newLines.pop();

  const raw = rawDiff(oldLines, newLines);
  const rows: SplitDiffRow[] = [];
  let oldLn = 1;
  let newLn = 1;

  for (let i = 0; i < raw.length; i++) {
    const current = raw[i];
    if (current.type === "ctx") {
      rows.push({
        leftLn: oldLn++,
        rightLn: newLn++,
        leftText: current.text,
        rightText: current.text,
        leftKind: "ctx",
        rightKind: "ctx"
      });
      continue;
    }

    const dels: string[] = [];
    const adds: string[] = [];
    let j = i;

    while (j < raw.length && raw[j].type === "del") {
      dels.push(raw[j].text);
      j++;
    }
    while (j < raw.length && raw[j].type === "add") {
      adds.push(raw[j].text);
      j++;
    }

    if (dels.length === 0 && current.type === "add") {
      while (j < raw.length && raw[j].type === "add") {
        adds.push(raw[j].text);
        j++;
      }
    }

    const aligned = alignSplitBlock(dels, adds);
    for (const row of aligned) {
      rows.push({
        leftLn: row.leftKind === "del" ? oldLn++ : null,
        rightLn: row.rightKind === "add" ? newLn++ : null,
        leftText: row.leftText,
        rightText: row.rightText,
        leftKind: row.leftKind,
        rightKind: row.rightKind
      });
    }

    i = j - 1;
  }

  return pairUnmatchedRows(rows);
}

const KEYWORDS =
  /\b(using|namespace|public|private|protected|internal|class|record|abstract|sealed|static|async|await|override|virtual|new|return|var|readonly|const|void|string|int|bool|Task|IActionResult|HttpContext|get|set|if|else|for|foreach|in|out|ref|true|false|null|this|base)\b/g;
const STRINGS = /(["'`])(?:[^\\]|\\.)*?\1/g;
const COMMENTS = /(\/\/.*|\/\*[\s\S]*?\*\/|#.*)/g;
const NUMBERS = /\b(\d+(\.\d+)?)\b/g;
const TYPES = /\b([A-Z][A-Za-z0-9]*)\b/g;

function captureTokens(source: string, pattern: RegExp, className: string, prefix: string) {
  const values: string[] = [];
  const text = source.replace(pattern, (match) => {
    const token = `__${prefix}_${values.length}__`;
    values.push(`<span class="${className}">${match}</span>`);
    return token;
  });
  return { text, values };
}

export function tokenize(text: string): string {
  let s = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const strings = captureTokens(s, STRINGS, "tok-s", "tokstr");
  s = strings.text;

  const comments = captureTokens(s, COMMENTS, "tok-c", "tokcom");
  s = comments.text;

  s = s.replace(KEYWORDS, '<span class="tok-k">$&</span>');
  s = s.replace(NUMBERS, '<span class="tok-n">$&</span>');
  s = s.replace(TYPES, '<span class="tok-t">$&</span>');

  for (let i = 0; i < comments.values.length; i++) {
    s = s.split(`__tokcom_${i}__`).join(comments.values[i]);
  }
  for (let i = 0; i < strings.values.length; i++) {
    s = s.split(`__tokstr_${i}__`).join(strings.values[i]);
  }

  return s;
}
