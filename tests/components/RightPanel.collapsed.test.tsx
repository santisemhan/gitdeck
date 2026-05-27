import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RightPanel } from "../../src/renderer/src/components/RightPanel";

function baseProps(): React.ComponentProps<typeof RightPanel> {
  return {
    repoPath: "/repo",
    mode: "localChanges",
    selectedCommit: null,
    commitFiles: [],
    unstagedFiles: [],
    stagedFiles: [],
    currentBranch: "main",
    totalLocalChanges: 0,
    onSelectFile: vi.fn(),
    onStageFile: vi.fn(),
    onUnstageFile: vi.fn(),
    onStageAll: vi.fn(),
    onUnstageAll: vi.fn(),
    onRequestDiscardAll: vi.fn(),
    onCommit: vi.fn(),
    onViewLocalChanges: vi.fn(),
  };
}

describe("RightPanel collapsed rail", () => {
  afterEach(() => cleanup());

  it("renders only the rail when collapsed", () => {
    const { container } = render(<RightPanel {...baseProps()} collapsed onToggleCollapsed={vi.fn()} />);
    expect(container.querySelector(".panel-rail")).not.toBeNull();
    expect(container.querySelector(".rpanel")).toBeNull();
  });

  it("calls onToggleCollapsed when the rail button is clicked", () => {
    const onToggle = vi.fn();
    render(<RightPanel {...baseProps()} collapsed onToggleCollapsed={onToggle} />);
    fireEvent.click(screen.getByLabelText("Expand right panel"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("renders a floating collapse button when expanded with onToggleCollapsed", () => {
    const onToggle = vi.fn();
    render(<RightPanel {...baseProps()} onToggleCollapsed={onToggle} />);
    fireEvent.click(screen.getByLabelText("Collapse right panel"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("does NOT render the collapse button when onToggleCollapsed is omitted", () => {
    render(<RightPanel {...baseProps()} />);
    expect(screen.queryByLabelText("Collapse right panel")).toBeNull();
  });

  it("renders a resize handle when onStartResize is provided", () => {
    const onStartResize = vi.fn();
    render(<RightPanel {...baseProps()} onStartResize={onStartResize} />);
    const handle = screen.getByLabelText("Resize right panel");
    fireEvent.mouseDown(handle, { clientX: 100 });
    expect(onStartResize).toHaveBeenCalledTimes(1);
  });

  it("does NOT render a resize handle when collapsed", () => {
    render(
      <RightPanel
        {...baseProps()}
        collapsed
        onToggleCollapsed={vi.fn()}
        onStartResize={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("Resize right panel")).toBeNull();
  });
});
