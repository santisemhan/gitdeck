import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { usePanelWidth } from "../../src/renderer/src/hooks/usePanelWidth";

function fireDragSequence(startX: number, deltas: number[]): void {
  // Note: the hook reads clientX from the actual MouseEvent — we send move events directly.
  for (const delta of deltas) {
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: startX + delta }));
  }
}

function reactMouseEvent(clientX: number) {
  return {
    preventDefault: () => {},
    clientX,
  } as unknown as React.MouseEvent;
}

describe("usePanelWidth", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("initializes from initial when storage is empty", () => {
    const { result } = renderHook(() =>
      usePanelWidth({ initial: 240, min: 100, max: 800, grow: "right" }),
    );
    expect(result.current.width).toBe(240);
  });

  it("clamps initial value to min/max on construction", () => {
    localStorage.setItem("k", "50");
    const { result } = renderHook(() =>
      usePanelWidth({ initial: 240, min: 100, max: 800, storageKey: "k", grow: "right" }),
    );
    expect(result.current.width).toBe(100);
  });

  it("grow=right increases width when dragging to the right", () => {
    const { result } = renderHook(() =>
      usePanelWidth({ initial: 200, min: 100, max: 800, grow: "right" }),
    );

    act(() => result.current.startResize(reactMouseEvent(500)));
    act(() => fireDragSequence(500, [60]));
    expect(result.current.width).toBe(260);
  });

  it("grow=left increases width when dragging to the left", () => {
    const { result } = renderHook(() =>
      usePanelWidth({ initial: 200, min: 100, max: 800, grow: "left" }),
    );

    act(() => result.current.startResize(reactMouseEvent(500)));
    act(() => fireDragSequence(500, [-80]));
    expect(result.current.width).toBe(280);
  });

  it("clamps to min during drag", () => {
    const { result } = renderHook(() =>
      usePanelWidth({ initial: 200, min: 150, max: 800, grow: "right" }),
    );
    act(() => result.current.startResize(reactMouseEvent(500)));
    act(() => fireDragSequence(500, [-500]));
    expect(result.current.width).toBe(150);
  });

  it("clamps to max during drag", () => {
    const { result } = renderHook(() =>
      usePanelWidth({ initial: 200, min: 100, max: 400, grow: "right" }),
    );
    act(() => result.current.startResize(reactMouseEvent(500)));
    act(() => fireDragSequence(500, [600]));
    expect(result.current.width).toBe(400);
  });

  it("uses a dynamic max recomputed each tick", () => {
    let dynamicMax = 500;
    const { result } = renderHook(() =>
      usePanelWidth({ initial: 200, min: 100, max: () => dynamicMax, grow: "right" }),
    );

    act(() => result.current.startResize(reactMouseEvent(500)));
    act(() => fireDragSequence(500, [400]));
    expect(result.current.width).toBe(500);

    dynamicMax = 300;
    act(() => fireDragSequence(500, [400]));
    expect(result.current.width).toBe(300);
  });

  it("stops resizing on mouseup", () => {
    const { result } = renderHook(() =>
      usePanelWidth({ initial: 200, min: 100, max: 800, grow: "right" }),
    );
    act(() => result.current.startResize(reactMouseEvent(500)));
    act(() => fireDragSequence(500, [50]));
    expect(result.current.width).toBe(250);
    act(() => window.dispatchEvent(new MouseEvent("mouseup")));
    act(() => fireDragSequence(500, [500]));
    expect(result.current.width).toBe(250);
  });

  it("persists the width to localStorage when storageKey is provided", () => {
    const { result } = renderHook(() =>
      usePanelWidth({ initial: 200, min: 100, max: 800, storageKey: "panel:w", grow: "right" }),
    );
    act(() => result.current.startResize(reactMouseEvent(500)));
    act(() => fireDragSequence(500, [30]));
    expect(localStorage.getItem("panel:w")).toBe("230");
  });

  it("setWidth re-clamps to the current bounds", () => {
    let max = 600;
    const { result, rerender } = renderHook(() =>
      usePanelWidth({ initial: 200, min: 100, max: () => max, grow: "right" }),
    );
    act(() => result.current.setWidth(9999));
    expect(result.current.width).toBe(600);
    max = 250;
    rerender();
    act(() => result.current.setWidth(result.current.width));
    expect(result.current.width).toBe(250);
  });
});
