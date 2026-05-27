import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BranchSidebar } from "../../src/renderer/src/components/BranchSidebar";
import type { LocalBranch, RemoteBranch } from "../../src/renderer/src/data/types";

function localBranch(name: string, current = false): LocalBranch {
  return {
    id: "b-" + name,
    name,
    type: "local",
    current,
    ahead: 0,
    behind: 0,
    lastActivity: "",
  };
}

function remoteBranch(name: string, remote = "origin"): RemoteBranch {
  return {
    id: "r-" + remote + "-" + name,
    name,
    type: "remote",
    remote,
  };
}

function setup(overrides: Partial<React.ComponentProps<typeof BranchSidebar>> = {}) {
  return render(
    <BranchSidebar
      localBranches={[localBranch("main", true), localBranch("feature/x")]}
      remoteBranches={[remoteBranch("main"), remoteBranch("dev")]}
      currentBranchId="b-main"
      onSelectBranch={vi.fn()}
      onCheckoutBranch={vi.fn()}
      onCreateBranchFrom={vi.fn()}
      onDeleteBranch={vi.fn()}
      onRequestRenameBranch={vi.fn()}
      {...overrides}
    />,
  );
}

describe("BranchSidebar", () => {
  afterEach(() => cleanup());

  it("renders local and remote sections with branch names", () => {
    setup();
    expect(screen.getByText("Local")).toBeInTheDocument();
    expect(screen.getByText("Remote")).toBeInTheDocument();
    expect(screen.getAllByText("main").length).toBeGreaterThan(0);
    expect(screen.getByText("feature/x")).toBeInTheDocument();
    expect(screen.getByText("dev")).toBeInTheDocument();
  });

  it("opens a context menu on right-click and closes on Escape", () => {
    setup();
    const featureRow = screen.getByText("feature/x").closest(".branch-row")!;
    fireEvent.contextMenu(featureRow, { clientX: 50, clientY: 50 });
    expect(screen.getByText("New branch from here")).toBeInTheDocument();
    expect(screen.getByText("Delete branch")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("New branch from here")).toBeNull();
  });

  it("closes the context menu when mousedown fires on the document", () => {
    setup();
    const featureRow = screen.getByText("feature/x").closest(".branch-row")!;
    fireEvent.contextMenu(featureRow, { clientX: 50, clientY: 50 });
    expect(screen.getByText("New branch from here")).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("New branch from here")).toBeNull();
  });

  describe("collapsed rail", () => {
    it("renders only the rail when collapsed", () => {
      const { container } = setup({ collapsed: true, onToggleCollapsed: vi.fn() });
      expect(container.querySelector(".panel-rail")).not.toBeNull();
      expect(container.querySelector(".sidebar")).toBeNull();
      // Branch list should NOT render in collapsed mode
      expect(screen.queryByText("feature/x")).toBeNull();
    });

    it("calls onToggleCollapsed when the expand button is clicked", () => {
      const onToggle = vi.fn();
      setup({ collapsed: true, onToggleCollapsed: onToggle });
      fireEvent.click(screen.getByLabelText("Expand branch sidebar"));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("renders a collapse button in the header when expanded with onToggleCollapsed", () => {
      const onToggle = vi.fn();
      setup({ collapsed: false, onToggleCollapsed: onToggle });
      fireEvent.click(screen.getByLabelText("Collapse branch sidebar"));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("does NOT render the collapse button when onToggleCollapsed is omitted", () => {
      setup({});
      expect(screen.queryByLabelText("Collapse branch sidebar")).toBeNull();
    });
  });

  describe("resize handle", () => {
    it("renders a resize handle when onStartResize is provided", () => {
      const onStartResize = vi.fn();
      setup({ onStartResize });
      const handle = screen.getByLabelText("Resize branch sidebar");
      expect(handle).toBeInTheDocument();
      fireEvent.mouseDown(handle, { clientX: 100 });
      expect(onStartResize).toHaveBeenCalledTimes(1);
    });

    it("does NOT render a resize handle when collapsed", () => {
      setup({ collapsed: true, onToggleCollapsed: vi.fn(), onStartResize: vi.fn() });
      expect(screen.queryByLabelText("Resize branch sidebar")).toBeNull();
    });
  });
});
