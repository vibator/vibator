import { describe, expect, it } from "vitest";
import { snippetAround } from "./snippet.ts";

/** A ten-line sample file. */
const sample = Array.from({ length: 10 }, (_, index) => `line ${index + 1}`)
  .join("\n")
  .concat("\n");

describe("snippetAround", () => {
  it("marks the reported line and shows two lines each side", () => {
    const excerpt = snippetAround(sample, 5);
    expect(excerpt).toBe(
      [
        "  3 | line 3",
        "  4 | line 4",
        "> 5 | line 5",
        "  6 | line 6",
        "  7 | line 7",
      ].join("\n"),
    );
  });

  it("clamps at the start of the file", () => {
    const excerpt = snippetAround(sample, 1);
    expect(excerpt?.split("\n")[0]).toBe("> 1 | line 1");
    expect(excerpt?.split("\n")).toHaveLength(3);
  });

  it("clamps at the end of the file", () => {
    const excerpt = snippetAround("a\nb\nc\n", 3);
    expect(excerpt?.split("\n").at(-1)).toBe("> 3 | c");
  });

  it("returns nothing for a line outside the file", () => {
    expect(snippetAround("a\nb\n", 99)).toBeUndefined();
    expect(snippetAround("a\nb\n", 0)).toBeUndefined();
  });

  it("pads line numbers to a common width", () => {
    const long = Array.from({ length: 120 }, (_, index) => `l${index}`).join(
      "\n",
    );
    const excerpt = snippetAround(long, 99);
    expect(excerpt?.split("\n")[0]).toBe("   97 | l96");
  });

  it("clips lines too long to be worth printing", () => {
    const excerpt = snippetAround(`${"x".repeat(500)}\n`, 1);
    expect(excerpt?.length).toBeLessThan(250);
    expect(excerpt?.endsWith("…")).toBe(true);
  });
});
