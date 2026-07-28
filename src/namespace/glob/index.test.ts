import { describe, expect, it } from "vitest";
import { glob } from "./index.ts";

describe("glob.matches", () => {
  it("matches a single glob", () => {
    expect(glob.matches("src/a.ts", "src/**")).toBe(true);
    expect(glob.matches("test/a.ts", "src/**")).toBe(false);
  });

  it("matches when any of several globs match", () => {
    expect(glob.matches("test/a.ts", ["src/**", "test/**"])).toBe(true);
  });

  it("matches every path when there is no inclusion glob", () => {
    expect(glob.matches("anything.ts", [])).toBe(true);
    expect(glob.matches("anything.ts", "!src/**")).toBe(true);
  });

  it("excludes a path hit by a negated glob", () => {
    expect(glob.matches("src/a.ts", ["**/*.ts", "!src/**"])).toBe(false);
    expect(glob.matches("test/a.ts", ["**/*.ts", "!src/**"])).toBe(true);
  });
});
