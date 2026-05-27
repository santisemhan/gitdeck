import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  readDraftValue,
  readStoredBoolean,
  readStoredNumber,
  writeDraftValue,
  writeStoredBoolean,
  writeStoredNumber,
} from "../../src/renderer/src/utils/storage";

describe("storage helpers", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  describe("readStoredNumber / writeStoredNumber", () => {
    it("round-trips a number", () => {
      writeStoredNumber("k", 42);
      expect(readStoredNumber("k", 0)).toBe(42);
    });

    it("falls back when key is missing", () => {
      expect(readStoredNumber("missing", 7)).toBe(7);
    });

    it("falls back when stored value is not numeric", () => {
      localStorage.setItem("bad", "not-a-number");
      expect(readStoredNumber("bad", 99)).toBe(99);
    });

    it("falls back when stored value is empty string", () => {
      localStorage.setItem("empty", "");
      expect(readStoredNumber("empty", 5)).toBe(5);
    });

    it("preserves zero values", () => {
      writeStoredNumber("zero", 0);
      expect(readStoredNumber("zero", 99)).toBe(0);
    });
  });

  describe("readDraftValue / writeDraftValue", () => {
    it("round-trips a string", () => {
      writeDraftValue("d", "hello");
      expect(readDraftValue("d")).toBe("hello");
    });

    it("returns empty string when key is missing", () => {
      expect(readDraftValue("missing")).toBe("");
    });

    it("removes the key when value is empty", () => {
      writeDraftValue("d", "hello");
      writeDraftValue("d", "");
      expect(localStorage.getItem("d")).toBeNull();
    });

    it("overwrites previous draft", () => {
      writeDraftValue("d", "first");
      writeDraftValue("d", "second");
      expect(readDraftValue("d")).toBe("second");
    });
  });

  describe("readStoredBoolean / writeStoredBoolean", () => {
    it("round-trips true and false", () => {
      writeStoredBoolean("b", true);
      expect(readStoredBoolean("b", false)).toBe(true);
      writeStoredBoolean("b", false);
      expect(readStoredBoolean("b", true)).toBe(false);
    });

    it("returns the fallback when key is missing", () => {
      expect(readStoredBoolean("missing", true)).toBe(true);
      expect(readStoredBoolean("missing", false)).toBe(false);
    });

    it("accepts both '1'/'0' and 'true'/'false' encodings", () => {
      localStorage.setItem("a", "true");
      localStorage.setItem("b", "false");
      localStorage.setItem("c", "1");
      localStorage.setItem("d", "0");
      expect(readStoredBoolean("a", false)).toBe(true);
      expect(readStoredBoolean("b", true)).toBe(false);
      expect(readStoredBoolean("c", false)).toBe(true);
      expect(readStoredBoolean("d", true)).toBe(false);
    });

    it("falls back when stored value is garbage", () => {
      localStorage.setItem("k", "yes-please");
      expect(readStoredBoolean("k", true)).toBe(true);
      expect(readStoredBoolean("k", false)).toBe(false);
    });
  });
});
