import { GitFileChange, GitFileKind } from "../../shared/types";

export function fileKindSymbol(kind: GitFileKind): string {
  switch (kind) {
    case "added":
      return "+";
    case "deleted":
      return "-";
    case "modified":
      return "~";
    case "renamed":
      return "R";
    case "copied":
      return "C";
    case "untracked":
      return "U";
    case "conflicted":
      return "!";
    default:
      return "M";
  }
}

export function fileKindClass(kind: GitFileKind): string {
  switch (kind) {
    case "added":
    case "copied":
      return "added";
    case "deleted":
      return "deleted";
    case "conflicted":
      return "conflicted";
    case "renamed":
      return "renamed";
    case "untracked":
      return "untracked";
    default:
      return "modified";
  }
}

export function shortPath(input: string): string {
  if (input.length <= 52) return input;
  return `...${input.slice(input.length - 49)}`;
}

export function countStaged(changes: GitFileChange[]): number {
  return changes.filter((c) => c.staged).length;
}

export function countUnstaged(changes: GitFileChange[]): number {
  return changes.filter((c) => c.unstaged || c.untracked).length;
}
