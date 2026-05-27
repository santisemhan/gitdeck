import type { ChangedFile } from "./types";

export function splitPath(path: string): { dir: string; file: string } {
  const idx = path.lastIndexOf("/");
  if (idx === -1) return { dir: "", file: path };
  return { dir: path.slice(0, idx + 1), file: path.slice(idx + 1) };
}

export function summarizeCounts(files: ChangedFile[]): {
  added: number;
  modified: number;
  deleted: number;
  renamed: number;
} {
  const c = { added: 0, modified: 0, deleted: 0, renamed: 0 };
  for (const f of files) c[f.status] += 1;
  return c;
}

export function initials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}
