import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeleteWorktreeDialog } from "../../src/renderer/src/components/DeleteWorktreeDialog";
import type { WorktreeInfo } from "../../src/shared/types";

const mockWorktree: WorktreeInfo = {
  path: "/Users/test/repos/my-app-feature",
  branch: "feature-branch",
  isMain: false,
  isOrphaned: false,
  hasChanges: false,
};

const mockWorktreeWithChanges: WorktreeInfo = {
  ...mockWorktree,
  hasChanges: true,
};

function setup(overrides: Partial<React.ComponentProps<typeof DeleteWorktreeDialog>> = {}) {
  return render(
    <DeleteWorktreeDialog
      isOpen={true}
      worktree={mockWorktree}
      loading={false}
      error={null}
      onClose={vi.fn()}
      onConfirm={vi.fn()}
      {...overrides}
    />,
  );
}

describe("DeleteWorktreeDialog", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders banner with worktree name", () => {
    setup();
    expect(screen.getByText("Delete worktree feature-branch?")).toBeInTheDocument();
  });

  it("shows warning for worktree with uncommitted changes", () => {
    setup({ worktree: mockWorktreeWithChanges });
    expect(screen.getByText(/This worktree has uncommitted changes/)).toBeInTheDocument();
  });

  it("does not show warning for worktree without changes", () => {
    setup();
    expect(screen.queryByText(/This worktree has uncommitted changes/)).not.toBeInTheDocument();
  });

  it("calls onConfirm when delete button is clicked", () => {
    const onConfirm = vi.fn();
    setup({ onConfirm });
    fireEvent.click(screen.getByText("Delete"));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("calls onClose when cancel button is clicked", () => {
    const onClose = vi.fn();
    setup({ onClose });
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows loading state when deleting", () => {
    setup({ loading: true });
    expect(screen.getByText("Deleting...")).toBeInTheDocument();
    expect(screen.getByText("Deleting...")).toBeDisabled();
    expect(screen.getByText("Cancel")).toBeDisabled();
  });

  it("displays error message when provided", () => {
    setup({ error: "Failed to delete worktree" });
    expect(screen.getByText("Failed to delete worktree")).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <DeleteWorktreeDialog
        isOpen={false}
        worktree={mockWorktree}
        loading={false}
        error={null}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(container.querySelector(".discard-global-banner")).not.toBeInTheDocument();
  });

  it("does not render when worktree is null", () => {
    const { container } = render(
      <DeleteWorktreeDialog
        isOpen={true}
        worktree={null}
        loading={false}
        error={null}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(container.querySelector(".discard-global-banner")).not.toBeInTheDocument();
  });

  it("has proper accessibility attributes", () => {
    setup();
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toBeInTheDocument();
  });
});
