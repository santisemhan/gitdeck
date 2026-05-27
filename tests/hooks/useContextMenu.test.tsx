import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useContextMenu } from "../../src/renderer/src/hooks/useContextMenu";

type Payload = { x: number; y: number; label: string };

describe("useContextMenu", () => {
  afterEach(() => vi.restoreAllMocks());

  it("starts with null menu", () => {
    const { result } = renderHook(() => useContextMenu<Payload>());
    expect(result.current.menu).toBeNull();
  });

  it("open sets the payload, close clears it", () => {
    const { result } = renderHook(() => useContextMenu<Payload>());
    act(() => result.current.open({ x: 1, y: 2, label: "hi" }));
    expect(result.current.menu).toEqual({ x: 1, y: 2, label: "hi" });
    act(() => result.current.close());
    expect(result.current.menu).toBeNull();
  });

  it("closes on document mousedown when open", () => {
    const { result } = renderHook(() => useContextMenu<Payload>());
    act(() => result.current.open({ x: 1, y: 2, label: "hi" }));
    act(() => {
      document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(result.current.menu).toBeNull();
  });

  it("closes on Escape keydown when open", () => {
    const { result } = renderHook(() => useContextMenu<Payload>());
    act(() => result.current.open({ x: 1, y: 2, label: "hi" }));
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(result.current.menu).toBeNull();
  });

  it("does NOT close on other keys", () => {
    const { result } = renderHook(() => useContextMenu<Payload>());
    act(() => result.current.open({ x: 1, y: 2, label: "hi" }));
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    });
    expect(result.current.menu).not.toBeNull();
  });

  it("removes document listeners after close", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { result } = renderHook(() => useContextMenu<Payload>());
    act(() => result.current.open({ x: 1, y: 2, label: "hi" }));
    act(() => result.current.close());
    expect(removeSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
  });

  it("removes document listeners on unmount while open", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { result, unmount } = renderHook(() => useContextMenu<Payload>());
    act(() => result.current.open({ x: 1, y: 2, label: "hi" }));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
  });
});
