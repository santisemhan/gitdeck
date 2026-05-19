import type { FileStatus } from "../data/types";
import { IconMinus, IconPencil, IconPlus, IconRename } from "./icons";

export function FileStatusIcon({ status, size = 14 }: { status: FileStatus; size?: number }) {
  if (status === "added")
    return (
      <span className="status-icon add">
        <IconPlus size={size} />
      </span>
    );
  if (status === "deleted")
    return (
      <span className="status-icon del">
        <IconMinus size={size} />
      </span>
    );
  if (status === "modified")
    return (
      <span className="status-icon mod">
        <IconPencil size={size} />
      </span>
    );
  if (status === "renamed")
    return (
      <span className="status-icon ren">
        <IconRename size={size} />
      </span>
    );
  return null;
}
