import { describe, expect, it } from "vitest";
import { locationOf } from "./diagnostic.ts";

describe("locationOf", () => {
  it("renders file, line and column when all are present", () => {
    expect(locationOf({ file: "a.ts", line: 3, column: 7, message: "x" })).toBe(
      "a.ts:3:7",
    );
  });

  it("drops the column when absent", () => {
    expect(locationOf({ file: "a.ts", line: 3, message: "x" })).toBe("a.ts:3");
  });

  it("renders the bare file when no line is known", () => {
    expect(locationOf({ file: "a.ts", message: "x" })).toBe("a.ts");
  });

  it("marks project-wide findings", () => {
    expect(locationOf({ message: "x" })).toBe("<project>");
  });
});
