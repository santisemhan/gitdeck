import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommitForm } from "../../src/renderer/src/components/CommitForm";
import { getCommitDraftStorageKeys } from "../../src/renderer/src/constants/storageKeys";

function setup(props: Partial<React.ComponentProps<typeof CommitForm>> = {}) {
  const onCommit = vi.fn();
  const onStartResize = vi.fn();
  const utils = render(
    <CommitForm
      repoPath="/repo/a"
      stagedCount={0}
      onCommit={onCommit}
      height={200}
      onStartResize={onStartResize}
      {...props}
    />,
  );
  return { ...utils, onCommit, onStartResize };
}

describe("CommitForm", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("disables submit when no files are staged", () => {
    setup({ stagedCount: 0 });
    const button = screen.getByRole("button", { name: /Stage Changes to Commit/i });
    expect(button).toBeDisabled();
  });

  it("disables submit when summary is empty even if files are staged", () => {
    setup({ stagedCount: 3 });
    const button = screen.getByRole("button", { name: /Commit 3 files/i });
    expect(button).toBeDisabled();
  });

  it("enables submit when summary present and files staged; commits and clears", async () => {
    const user = userEvent.setup();
    const { onCommit } = setup({ stagedCount: 2 });
    const summary = screen.getByPlaceholderText("Commit summary");
    const desc = screen.getByPlaceholderText("Description");
    await user.type(summary, "  fix bug  ");
    await user.type(desc, "details");
    const button = screen.getByRole("button", { name: /Commit 2 files/i });
    expect(button).toBeEnabled();
    await user.click(button);
    expect(onCommit).toHaveBeenCalledWith("fix bug", "details");
    expect((summary as HTMLInputElement).value).toBe("");
    expect((desc as HTMLTextAreaElement).value).toBe("");
  });

  it("button label reads singular when stagedCount is 1", async () => {
    const user = userEvent.setup();
    setup({ stagedCount: 1 });
    await user.type(screen.getByPlaceholderText("Commit summary"), "x");
    expect(screen.getByRole("button", { name: "Commit 1 file" })).toBeInTheDocument();
  });

  it("counter goes red when remaining < 10", async () => {
    const user = userEvent.setup();
    const { container } = setup({ stagedCount: 1 });
    const longText = "a".repeat(65);
    await user.type(screen.getByPlaceholderText("Commit summary"), longText);
    const counter = container.querySelector(".counter");
    expect(counter?.className).toContain("danger");
  });

  it("rehydrates draft from localStorage on mount", () => {
    const keys = getCommitDraftStorageKeys("/repo/a");
    localStorage.setItem(keys.summary, "saved summary");
    localStorage.setItem(keys.description, "saved desc");
    setup();
    expect((screen.getByPlaceholderText("Commit summary") as HTMLInputElement).value).toBe("saved summary");
    expect((screen.getByPlaceholderText("Description") as HTMLTextAreaElement).value).toBe("saved desc");
  });

  it("switching repoPath reloads the draft for that repo", () => {
    const keysA = getCommitDraftStorageKeys("/repo/a");
    const keysB = getCommitDraftStorageKeys("/repo/b");
    localStorage.setItem(keysA.summary, "draft A");
    localStorage.setItem(keysB.summary, "draft B");
    const { rerender } = setup({ repoPath: "/repo/a" });
    expect((screen.getByPlaceholderText("Commit summary") as HTMLInputElement).value).toBe("draft A");
    rerender(
      <CommitForm
        repoPath="/repo/b"
        stagedCount={0}
        onCommit={() => {}}
        height={200}
        onStartResize={() => {}}
      />,
    );
    expect((screen.getByPlaceholderText("Commit summary") as HTMLInputElement).value).toBe("draft B");
  });

  it("persists summary to localStorage on type and removes on clear", async () => {
    const user = userEvent.setup();
    const keys = getCommitDraftStorageKeys("/repo/a");
    setup({ stagedCount: 1 });
    const summary = screen.getByPlaceholderText("Commit summary");
    await user.type(summary, "hello");
    expect(localStorage.getItem(keys.summary)).toBe("hello");
    await user.clear(summary);
    expect(localStorage.getItem(keys.summary)).toBeNull();
  });
});
