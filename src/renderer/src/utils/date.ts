export type DateGroup = string;

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function diffCalendarDays(from: Date, to: Date): number {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((startOfLocalDay(from).getTime() - startOfLocalDay(to).getTime()) / dayMs);
}

export function monthDiff(now: Date, date: Date): number {
  return (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
}

export function toDateGroup(dateISO: string, now: Date): DateGroup {
  const date = new Date(dateISO);
  if (Number.isNaN(date.getTime())) return "m-unknown";
  if (now.getFullYear() === date.getFullYear() && now.getMonth() === date.getMonth()) {
    const dayDiff = Math.max(0, diffCalendarDays(now, date));
    const weeks = Math.floor(dayDiff / 7);
    if (weeks >= 1) return `w-${weeks}`;
  }
  return `m-${Math.max(0, monthDiff(now, date))}`;
}

export function dateGroupLabel(group: DateGroup): string {
  if (group.startsWith("w-")) {
    const weeks = Number(group.slice(2));
    if (!Number.isFinite(weeks) || weeks < 1) return "Older";
    if (weeks === 1) return "a week ago";
    return `${weeks} weeks ago`;
  }
  if (!group.startsWith("m-")) return "Older";
  const months = Number(group.slice(2));
  if (!Number.isFinite(months) || months < 0) return "Older";
  if (months < 12) {
    if (months === 1) return "a month ago";
    return `${months} months ago`;
  }
  const years = Math.floor(months / 12);
  if (years === 1) return "a year ago";
  return `${years} years ago`;
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

export function formatRelativeTime(
  iso: string,
  options?: { empty?: string; invalid?: string }
): string {
  const empty = options?.empty ?? "";
  if (!iso) return empty;

  const then = new Date(iso).getTime();
  const invalid = options?.invalid ?? iso;
  if (Number.isNaN(then)) return invalid;

  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(mo / 12);
  return `${y}y ago`;
}
