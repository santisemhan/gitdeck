import { useState } from "react";
import { IconBranch, IconHome, IconX } from "./icons";
import type { DropSide, RepoTab } from "../data/types";

interface RepoTabBarProps {
  openRepos: RepoTab[];
  activePath: string | null;
  /** Navigate to the Home / launcher screen (does not close open tabs). */
  onGoHome: () => void;
  /** Close the New tab (Home) screen, switching to an open repo if any. */
  onCloseHome: () => void;
  onSwitchRepo: (path: string) => void;
  onCloseRepo: (path: string) => void;
  onReorderRepo: (sourcePath: string, targetPath: string, placeAfter?: boolean) => void;
}

export function RepoTabBar({
  openRepos,
  activePath,
  onGoHome,
  onCloseHome,
  onSwitchRepo,
  onCloseRepo,
  onReorderRepo
}: RepoTabBarProps) {
  const [draggingPath, setDraggingPath] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ path: string; side: DropSide } | null>(null);

  const clearDrag = () => {
    setDraggingPath(null);
    setDropTarget(null);
  };

  const handleDrop = (targetPath: string, side: DropSide, sourceFromData?: string) => {
    const sourcePath = sourceFromData || draggingPath;
    if (!sourcePath || sourcePath === targetPath) {
      clearDrag();
      return;
    }
    onReorderRepo(sourcePath, targetPath, side === "after");
    clearDrag();
  };

  const onHome = activePath === null;

  return (
    <div className="tabbar">
      {openRepos.map((openRepo) => {
        const isActive = openRepo.path === activePath;
        const isDragging = openRepo.path === draggingPath;
        const isDropBefore = dropTarget?.path === openRepo.path && dropTarget.side === "before";
        const isDropAfter = dropTarget?.path === openRepo.path && dropTarget.side === "after";
        return (
          <div
            key={openRepo.path}
            className={
              "tab" +
              (isActive ? " active" : "") +
              (isDragging ? " dragging" : "") +
              (isDropBefore ? " drop-before" : "") +
              (isDropAfter ? " drop-after" : "")
            }
            onClick={() => onSwitchRepo(openRepo.path)}
            title={openRepo.path}
            draggable
            onDragStart={(event) => {
              setDraggingPath(openRepo.path);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", openRepo.path);
            }}
            onDragOver={(event) => {
              if (!draggingPath || draggingPath === openRepo.path) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              const rect = event.currentTarget.getBoundingClientRect();
              const side: DropSide = event.clientX < rect.left + rect.width / 2 ? "before" : "after";
              setDropTarget((current) =>
                current?.path === openRepo.path && current.side === side
                  ? current
                  : { path: openRepo.path, side }
              );
            }}
            onDragLeave={(event) => {
              // Only clear if we're actually leaving this tab (not entering a child).
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setDropTarget((current) => (current?.path === openRepo.path ? null : current));
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              const side: DropSide = event.clientX < rect.left + rect.width / 2 ? "before" : "after";
              const sourcePath = event.dataTransfer.getData("text/plain");
              handleDrop(openRepo.path, side, sourcePath);
            }}
            onDragEnd={clearDrag}
          >
            <span className="branch-icon">
              <IconBranch size={11} />
            </span>
            {openRepo.name}
            <button
              className="close"
              title="Close repository"
              onClick={(event) => {
                event.stopPropagation();
                onCloseRepo(openRepo.path);
              }}
            >
              <IconX size={10} />
            </button>
          </div>
        );
      })}
      {onHome && (
        <div className="tab home-tab active" title="New tab">
          <IconHome size={13} />
          New tab
          {openRepos.length > 0 && (
            <button
              className="close"
              title="Close tab"
              onClick={(event) => {
                event.stopPropagation();
                onCloseHome();
              }}
            >
              <IconX size={10} />
            </button>
          )}
        </div>
      )}
      <button className="new-tab" title="New tab" onClick={onGoHome}>
        +
      </button>
    </div>
  );
}
