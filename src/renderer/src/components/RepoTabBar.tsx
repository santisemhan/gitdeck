import { useState } from "react";
import { IconBell, IconBranch, IconGear, IconX } from "./icons";

interface RepoTab {
  path: string;
  name: string;
}

interface RepoTabBarProps {
  openRepos: RepoTab[];
  activePath: string | null;
  onCloseAll: () => void;
  onSwitchRepo: (path: string) => void;
  onCloseRepo: (path: string) => void;
  onReorderRepo: (sourcePath: string, targetPath: string) => void;
}

export function RepoTabBar({
  openRepos,
  activePath,
  onCloseAll,
  onSwitchRepo,
  onCloseRepo,
  onReorderRepo
}: RepoTabBarProps) {
  const [draggingPath, setDraggingPath] = useState<string | null>(null);

  return (
    <div className="tabbar">
      <button className="icon-btn" title="Launchpad" onClick={onCloseAll}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 4h12M2 8h12M2 12h12" />
        </svg>
      </button>
      {openRepos.map((openRepo) => {
        const isActive = openRepo.path === activePath;
        const isDragging = openRepo.path === draggingPath;
        return (
          <div
            key={openRepo.path}
            className={"tab" + (isActive ? " active" : "") + (isDragging ? " dragging" : "")}
            onClick={() => onSwitchRepo(openRepo.path)}
            title={openRepo.path}
            draggable
            onDragStart={(event) => {
              setDraggingPath(openRepo.path);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", openRepo.path);
            }}
            onDragOver={(event) => {
              if (draggingPath && draggingPath !== openRepo.path) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              const sourcePath = event.dataTransfer.getData("text/plain") || draggingPath;
              if (sourcePath && sourcePath !== openRepo.path) {
                onReorderRepo(sourcePath, openRepo.path);
              }
              setDraggingPath(null);
            }}
            onDragEnd={() => setDraggingPath(null)}
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
      <button className="new-tab" title="Open repository" onClick={onCloseAll}>
        +
      </button>

      <div className="right">
        <button className="icon-btn" title="Notifications">
          <IconBell size={14} />
          <span className="dot" />
        </button>
        <button className="icon-btn" title="Settings">
          <IconGear size={14} />
        </button>
      </div>
    </div>
  );
}
