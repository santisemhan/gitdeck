import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorktreeSection } from "../../src/renderer/src/components/WorktreeSection";
import type { WorktreeInfo } from "../../src/shared/types";

const mockWorktrees: WorktreeInfo[] = [
  {
    path: "/Users/test/repos/my-app",
    branch: "main",
    isMain: true,
    isOrphaned: false,
    hasChanges: false,
  },
  {
    path: "/Users/test/repos/my-app-feature",
    branch: "feature-branch",
    isMain: false,
    isOrphaned: false,
    hasChanges: true,
  },
  {
    path: "/Users/test/repos/my-app-orphan",
    branch: "orphan-branch",
    isMain: false,
    isOrphaned: true,
    hasChanges: false,
  },
];

function setup(overrides: Partial<React.ComponentProps<typeof WorktreeSection>> = {}) {
  return render(
    <WorktreeSection
      worktrees={mockWorktrees}
      loading={false}
      error={null}
      onSelectWorktree={vi.fn()}
      onSwitchWorktree={vi.fn()}
      onDeleteWorktree={vi.fn()}
      onRenameWorktree={vi.fn()}
      onOpenInFinder={vi.fn()}
      onPruneWorktree={vi.fn()}
      {...overrides}
    />,
  );
}

describe("WorktreeSection", () => {
  afterEach(() => cleanup());

  it("renders section header with count", () => {
    setup();
    expect(screen.getByText("WORKTREES")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders worktree list with correct information", () => {
    setup();
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("feature-branch")).toBeInTheDocument();
    expect(screen.getByText("orphan-branch")).toBeInTheDocument();
  });

  it("distinguishes main worktree with badge", () => {
    setup();
    const mainBadge = screen.getByText("main");
    expect(mainBadge).toBeInTheDocument();
    expect(mainBadge.closest(".worktree-badge")).not.toBeNull();
  });

  it("shows dirty indicator for worktrees with changes", () => {
    setup();
    const dirtyIndicator = screen.getByText("M");
    expect(dirtyIndicator).toBeInTheDocument();
    expect(dirtyIndicator.closest(".branch-row")?.textContent).toContain("feature-branch");
  });

  it("shows loading state", () => {
    setup({ loading: true, worktrees: [] });
    expect(screen.getByText("Loading worktrees...")).toBeInTheDocument();
  });

  it("shows error state", () => {
    setup({ error: "Failed to load worktrees", worktrees: [] });
    expect(screen.getByText("Error: Failed to load worktrees")).toBeInTheDocument();
  });

  it("shows empty state when no worktrees", () => {
    setup({ worktrees: [] });
    expect(screen.getByText("No worktrees")).toBeInTheDocument();
  });

  it("calls onSelectWorktree when worktree is clicked", () => {
    const onSelect = vi.fn();
    setup({ onSelectWorktree: onSelect });
    const featureRow = screen.getByText("feature-branch").closest(".branch-row")!;
    fireEvent.click(featureRow);
    expect(onSelect).toHaveBeenCalledWith(mockWorktrees[1]);
  });

  it("calls onSwitchWorktree when worktree is double-clicked", () => {
    const onSwitch = vi.fn();
    setup({ onSwitchWorktree: onSwitch });
    const featureRow = screen.getByText("feature-branch").closest(".branch-row")!;
    fireEvent.doubleClick(featureRow);
    expect(onSwitch).toHaveBeenCalledWith(mockWorktrees[1]);
  });

  it("opens context menu on right-click", () => {
    setup();
    const featureRow = screen.getByText("feature-branch").closest(".branch-row")!;
    fireEvent.contextMenu(featureRow, { clientX: 50, clientY: 50 });
    expect(screen.getByText("Delete Worktree")).toBeInTheDocument();
    expect(screen.getByText("Rename")).toBeInTheDocument();
    expect(screen.getByText("Open in Finder")).toBeInTheDocument();
  });

  it("shows prune option for orphaned worktrees", () => {
    setup();
    const orphanRow = screen.getByText("orphan-branch").closest(".branch-row")!;
    fireEvent.contextMenu(orphanRow, { clientX: 50, clientY: 50 });
    expect(screen.getByText("Prune")).toBeInTheDocument();
    expect(screen.queryByText("Delete Worktree")).toBeNull();
    expect(screen.queryByText("Rename")).toBeNull();
  });

  it("calls onDeleteWorktree when delete is clicked", () => {
    const onDelete = vi.fn();
    setup({ onDeleteWorktree: onDelete });
    const featureRow = screen.getByText("feature-branch").closest(".branch-row")!;
    fireEvent.contextMenu(featureRow, { clientX: 50, clientY: 50 });
    fireEvent.click(screen.getByText("Delete Worktree"));
    expect(onDelete).toHaveBeenCalledWith(mockWorktrees[1]);
  });

  it("calls onPruneWorktree when prune is clicked", () => {
    const onPrune = vi.fn();
    setup({ onPruneWorktree: onPrune });
    const orphanRow = screen.getByText("orphan-branch").closest(".branch-row")!;
    fireEvent.contextMenu(orphanRow, { clientX: 50, clientY: 50 });
    fireEvent.click(screen.getByText("Prune"));
    expect(onPrune).toHaveBeenCalledWith(mockWorktrees[2]);
  });

  it("collapses section when header is clicked", () => {
    const onToggle = vi.fn();
    setup({ onToggleCollapsed: onToggle });
    fireEvent.click(screen.getByText("WORKTREES").closest(".section-header")!);
    expect(onToggle).toHaveBeenCalled();
  });
});
