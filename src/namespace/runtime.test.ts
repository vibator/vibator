import { describe, expect, it } from "vitest";
import {
  excludedDirectories,
  requireRoot,
  scopedFiles,
  setExcludedDirectories,
  setRoot,
  setScope,
} from "./runtime.ts";

describe("runtime", () => {
  it("throws when no root is set", () => {
    expect(() => requireRoot()).toThrow();
  });

  it("returns the root after setRoot", () => {
    setRoot("/abs/project");
    expect(requireRoot()).toBe("/abs/project");
  });

  it("overwrites the root on a second setRoot", () => {
    setRoot("/abs/other");
    expect(requireRoot()).toBe("/abs/other");
  });
});

describe("runtime excluded directories", () => {
  it("defaults to the built-in directories", () => {
    expect(excludedDirectories().has("node_modules")).toBe(true);
    expect(excludedDirectories().has("dist")).toBe(true);
  });

  it("replaces the defaults when set", () => {
    setExcludedDirectories(["vendor", "tmp"]);
    expect(excludedDirectories().has("vendor")).toBe(true);
    expect(excludedDirectories().has("node_modules")).toBe(false);
  });
});

describe("runtime scope", () => {
  it("has no scope by default", () => {
    expect(scopedFiles()).toBeUndefined();
  });

  it("holds the scoped files when set", () => {
    setScope(["a.ts", "b.ts"]);
    expect([...(scopedFiles() ?? [])].sort()).toEqual(["a.ts", "b.ts"]);
  });

  it("clears the scope when set to undefined", () => {
    setScope(["a.ts"]);
    setScope(undefined);
    expect(scopedFiles()).toBeUndefined();
  });
});
