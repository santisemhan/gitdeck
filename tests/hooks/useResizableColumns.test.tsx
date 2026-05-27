import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useResizableColumns } from "../../src/renderer/src/hooks/useResizableColumns";

function fireMouseDownOnDocument(clientX: number): void {
  document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX }));
}

function makeReactMouseEvent(clientX: number) {
  return {
    preventDefault: () => {},
    clientX,
  } as unknown as React.MouseEvent;
}

describe("useResizableColumns", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("initializes from initial values when storage is empty", () => {
    const { result } = renderHook(() =>
      useResizableColumns({
        keys: ["a", "b"] as const,
        initial: { a: 100, b: 200 },
        min: { a: 50, b: 50 },
      }),
    );
    expect(result.current.widths).toEqual({ a: 100, b: 200 });
  });

  it("hydrates from localStorage when storageKeys are provided", () => {
    localStorage.setItem("k:a", "180");
    const { result } = renderHook(() =>
      useResizableColumns({
        keys: ["a"] as const,
        initial: { a: 100 },
        min: { a: 50 },
        storageKeys: { a: "k:a" },
      }),
    );
    expect(result.current.widths.a).toBe(180);
  });

  it("clamps initial value to minimum", () => {
    localStorage.setItem("k:a", "10");
    const { result } = renderHook(() =>
      useResizableColumns({
        keys: ["a"] as const,
        initial: { a: 100 },
        min: { a: 50 },
        storageKeys: { a: "k:a" },
      }),
    );
    expect(result.current.widths.a).toBe(50);
  });

  it("updates width on mousemove after startResize", () => {
    const { result } = renderHook(() =>
      useResizableColumns({
        keys: ["a"] as const,
        initial: { a: 100 },
        min: { a: 50 },
      }),
    );

    act(() => {
      result.current.startResize("a")(makeReactMouseEvent(0));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 40 }));
    });
    expect(result.current.widths.a).toBe(140);
  });

  it("respects the minimum during drag", () => {
    const { result } = renderHook(() =>
      useResizableColumns({
        keys: ["a"] as const,
        initial: { a: 100 },
        min: { a: 80 },
      }),
    );

    act(() => result.current.startResize("a")(makeReactMouseEvent(0)));
    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: -200 }));
    });
    expect(result.current.widths.a).toBe(80);
  });

  it("stops resizing after mouseup", () => {
    const { result } = renderHook(() =>
      useResizableColumns({
        keys: ["a"] as const,
        initial: { a: 100 },
        min: { a: 50 },
      }),
    );

    act(() => result.current.startResize("a")(makeReactMouseEvent(0)));
    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 30 }));
    });
    expect(result.current.widths.a).toBe(130);

    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup"));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 500 }));
    });
    expect(result.current.widths.a).toBe(130);
  });

  it("persists widths to localStorage when storageKeys are provided", () => {
    const { result } = renderHook(() =>
      useResizableColumns({
        keys: ["a"] as const,
        initial: { a: 100 },
        min: { a: 50 },
        storageKeys: { a: "persist:a" },
      }),
    );

    act(() => result.current.startResize("a")(makeReactMouseEvent(0)));
    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 70 }));
    });

    expect(localStorage.getItem("persist:a")).toBe("170");
  });

  it("grows current width up to a new dynamic minimum", () => {
    let dynamicMin = 50;
    const { result, rerender } = renderHook(() =>
      useResizableColumns({
        keys: ["a"] as const,
        initial: { a: 60 },
        min: { a: () => dynamicMin },
      }),
    );

    expect(result.current.widths.a).toBe(60);
    dynamicMin = 200;
    rerender();
    expect(result.current.widths.a).toBe(200);
  });

  it("does not respond to mousemove before startResize is called", () => {
    const { result } = renderHook(() =>
      useResizableColumns({
        keys: ["a"] as const,
        initial: { a: 100 },
        min: { a: 50 },
      }),
    );
    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 200 }));
    });
    // also asserts the document mousedown helper has no effect by itself
    fireMouseDownOnDocument(123);
    expect(result.current.widths.a).toBe(100);
  });
});
