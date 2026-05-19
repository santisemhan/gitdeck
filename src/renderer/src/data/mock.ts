import type { ChangedFile } from "./types";

export function splitPath(path: string): { dir: string; file: string } {
  const idx = path.lastIndexOf("/");
  if (idx === -1) return { dir: "", file: path };
  return { dir: path.slice(0, idx + 1), file: path.slice(idx + 1) };
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} @ ${hh}:${min}`;
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
