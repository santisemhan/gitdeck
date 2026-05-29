import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateWorktreeDialog } from "../../src/renderer/src/components/CreateWorktreeDialog";
import { gitClient } from "../../src/renderer/src/services/gitClient";

vi.mock("../../src/renderer/src/services/gitClient", () => ({
  gitClient: {
    createWorktree: vi.fn(),
    listWorktrees: vi.fn(),
  },
}));

function setup(overrides: Partial<React.ComponentProps<typeof CreateWorktreeDialog>> = {}) {
  return render(
    <CreateWorktreeDialog
      isOpen={true}
      branchName="feature-branch"
      isRemote={false}
      repoPath="/Users/test/repos/my-app"
      onClose={vi.fn()}
      onCreated={vi.fn()}
      {...overrides}
    />,
  );
}

describe("CreateWorktreeDialog", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders banner with correct branch name", () => {
    setup();
    expect(screen.getByText("Create worktree from feature-branch")).toBeInTheDocument();
  });

  it("shows default target path", () => {
    setup();
    const targetInput = screen.getByPlaceholderText("/path/to/worktree");
    expect(targetInput).toHaveValue("/Users/test/repos/my-app/.worktrees/feature-branch");
  });

  it("validates empty target path", async () => {
    const onCreated = vi.fn();
    setup({ onCreated });
    const targetInput = screen.getByPlaceholderText("/path/to/worktree");
    fireEvent.change(targetInput, { target: { value: "" } });
    fireEvent.click(screen.getByText("Create"));
    await waitFor(() => {
      expect(screen.getByText("Target path is required")).toBeInTheDocument();
    });
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("validates target path inside repository", async () => {
    const onCreated = vi.fn();
    setup({ onCreated });
    const targetInput = screen.getByPlaceholderText("/path/to/worktree");
    fireEvent.change(targetInput, { target: { value: "/Users/test/repos/my-app/src" } });
    fireEvent.click(screen.getByText("Create"));
    await waitFor(() => {
      expect(screen.getByText("Cannot create worktree inside repository directory (use .worktrees/ subdirectory)")).toBeInTheDocument();
    });
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("validates path traversal", async () => {
    const onCreated = vi.fn();
    setup({ onCreated });
    const targetInput = screen.getByPlaceholderText("/path/to/worktree");
    fireEvent.change(targetInput, { target: { value: "/Users/test/../etc/passwd" } });
    fireEvent.click(screen.getByText("Create"));
    await waitFor(() => {
      expect(screen.getByText("Path contains invalid characters")).toBeInTheDocument();
    });
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("creates worktree successfully", async () => {
    vi.mocked(gitClient.createWorktree).mockResolvedValue({ ok: true, code: 0, stdout: "", stderr: "" });
    vi.mocked(gitClient.listWorktrees).mockResolvedValue([]);
    const onCreated = vi.fn();
    const onClose = vi.fn();
    setup({ onCreated, onClose });
    fireEvent.click(screen.getByText("Create"));
    await waitFor(() => {
      expect(gitClient.createWorktree).toHaveBeenCalledWith("/Users/test/repos/my-app", "feature-branch", "/Users/test/repos/my-app/.worktrees/feature-branch");
    });
    expect(onCreated).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("handles creation error", async () => {
    vi.mocked(gitClient.createWorktree).mockResolvedValue({ ok: false, code: 1, stdout: "", stderr: "Failed to create worktree", message: "Failed to create worktree" });
    vi.mocked(gitClient.listWorktrees).mockResolvedValue([]);
    const onCreated = vi.fn();
    setup({ onCreated });
    fireEvent.click(screen.getByText("Create"));
    await waitFor(() => {
      expect(screen.getByText("Failed to create worktree")).toBeInTheDocument();
    });
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("closes dialog when cancel is clicked", () => {
    const onClose = vi.fn();
    setup({ onClose });
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("submits form when Enter is pressed", async () => {
    vi.mocked(gitClient.createWorktree).mockResolvedValue({ ok: true, code: 0, stdout: "", stderr: "" });
    vi.mocked(gitClient.listWorktrees).mockResolvedValue([]);
    const onCreated = vi.fn();
    const onClose = vi.fn();
    setup({ onCreated, onClose });
    const targetInput = screen.getByPlaceholderText("/path/to/worktree");
    fireEvent.keyDown(targetInput, { key: "Enter" });
    await waitFor(() => {
      expect(gitClient.createWorktree).toHaveBeenCalled();
    });
  });

  it("shows create branch checkbox for remote branches", () => {
    setup({ isRemote: true });
    expect(screen.getByText("Create branch")).toBeInTheDocument();
  });

  it("does not show create branch checkbox for local branches", () => {
    setup({ isRemote: false });
    expect(screen.queryByText("Create branch")).not.toBeInTheDocument();
  });

  it("has proper accessibility attributes", () => {
    setup();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
  });
});
