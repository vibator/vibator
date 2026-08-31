import { describe, expect, it } from "vitest";
import { snippetAround } from "./snippet.ts";

describe("snippetAround", () => {
  const text = "one\ntwo\nthree\nfour\nfive";

  it("shows two lines of context around the line, marking it", () => {
    expect(snippetAround(text, 3)).toBe(
      "  1 | one\n  2 | two\n> 3 | three\n  4 | four\n  5 | five",
    );
  });

  it("marks every line in a range", () => {
    expect(snippetAround(text, 2, 3)).toBe(
      "  1 | one\n> 2 | two\n> 3 | three\n  4 | four\n  5 | five",
    );
  });

  it("clamps context at the file edges", () => {
    expect(snippetAround(text, 1)).toBe("> 1 | one\n  2 | two\n  3 | three");
  });

  it("drops a phantom final line from a trailing newline", () => {
    expect(snippetAround("a\nb\n", 2)).toBe("  1 | a\n> 2 | b");
  });

  it("returns undefined when the line is outside the file", () => {
    expect(snippetAround(text, 99)).toBeUndefined();
    expect(snippetAround(text, 0)).toBeUndefined();
  });

  it("clips an overlong line", () => {
    const long = `${"x".repeat(250)}`;
    const rendered = snippetAround(long, 1);
    expect(rendered).toBe(`> 1 | ${"x".repeat(200)}…`);
  });
});

describe("snippetAround, wide ranges", () => {
  const lines = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join(
    "\n",
  );

  it("returns undefined when the range covers the whole file", () => {
    expect(snippetAround("a\nb\nc\n", 1, 3)).toBeUndefined();
    expect(snippetAround("a\nb\nc", 1, 3)).toBeUndefined();
  });

  it("returns undefined when the range exceeds the range cap", () => {
    expect(snippetAround(lines, 2, 25)).toBeUndefined();
  });

  it("keeps a range within the cap", () => {
    expect(snippetAround(lines, 2, 21)).toContain("> 21 | line 21");
  });

  it("honors a custom range cap", () => {
    expect(snippetAround(lines, 2, 6, 2, 200, 3)).toBeUndefined();
  });
});
