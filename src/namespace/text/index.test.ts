import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { File } from "../project/index.ts";
import { text } from "./index.ts";

const dir = mkdtempSync(join(tmpdir(), "vibator-text-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
let counter = 0;

/** Writes content (or raw bytes) to a temp file and returns the File over it. */
function fileOf(content: string, bytes?: Buffer): File {
  const path = join(dir, `x${counter++}.ts`);
  writeFileSync(path, bytes ?? content);
  return new File(path);
}

describe("text.lines", () => {
  it("returns no lines for empty content", () => {
    expect(text.lines(fileOf(""))).toEqual([]);
  });

  it("numbers lines from 1", () => {
    expect(text.lines(fileOf("a\nb"))).toEqual([
      { number: 1, text: "a" },
      { number: 2, text: "b" },
    ]);
  });

  it("drops a single trailing newline rather than adding an empty line", () => {
    expect(text.lines(fileOf("a\nb\n"))).toEqual([
      { number: 1, text: "a" },
      { number: 2, text: "b" },
    ]);
  });

  it("keeps blank lines in the middle", () => {
    expect(text.lines(fileOf("a\n\nb"))).toEqual([
      { number: 1, text: "a" },
      { number: 2, text: "" },
      { number: 3, text: "b" },
    ]);
  });

  it("treats a lone newline as one empty line", () => {
    expect(text.lines(fileOf("\n"))).toEqual([{ number: 1, text: "" }]);
  });
});

describe("text.binary", () => {
  it("is false for text", () => {
    expect(text.binary(fileOf("hello"))).toBe(false);
  });

  it("is true when the bytes contain a NUL", () => {
    expect(text.binary(fileOf("", Buffer.from([104, 0, 105])))).toBe(true);
  });
});

describe("text.positionAt", () => {
  const file = fileOf("abc\ndef");

  it("is 1-based at the start", () => {
    expect(text.positionAt(file, 0)).toEqual({ line: 1, column: 1 });
  });

  it("places the newline at the end of its line", () => {
    expect(text.positionAt(file, 3)).toEqual({ line: 1, column: 4 });
  });

  it("moves to the next line after the newline", () => {
    expect(text.positionAt(file, 4)).toEqual({ line: 2, column: 1 });
  });

  it("resolves an offset at the end of the content", () => {
    expect(text.positionAt(file, 7)).toEqual({ line: 2, column: 4 });
  });
});

describe("text.matches", () => {
  it("finds every occurrence with its position", () => {
    expect(text.matches(fileOf("foo bar foo"), /foo/)).toEqual([
      { text: "foo", index: 0, line: 1, column: 1, groups: [] },
      { text: "foo", index: 8, line: 1, column: 9, groups: [] },
    ]);
  });

  it("returns captured groups", () => {
    expect(text.matches(fileOf("foo"), /f(o+)/)).toEqual([
      { text: "foo", index: 0, line: 1, column: 1, groups: ["oo"] },
    ]);
  });

  it("resolves position across lines", () => {
    expect(text.matches(fileOf("a\nfoo"), /foo/)).toEqual([
      { text: "foo", index: 2, line: 2, column: 1, groups: [] },
    ]);
  });
});

describe("text.maskComments", () => {
  it("blanks a line comment to the end of its line, keeping length", () => {
    expect(text.maskComments(fileOf("a // c\nb"))).toBe("a     \nb");
  });

  it("blanks a block comment, keeping length", () => {
    expect(text.maskComments(fileOf("x /* y */ z"))).toBe("x         z");
  });

  it("blanks a block comment across lines, keeping the newline", () => {
    expect(text.maskComments(fileOf("a/*\n*/b"))).toBe("a  \n  b");
  });
});

describe("text.maskCode", () => {
  it("blanks an inline code span, keeping length", () => {
    expect(text.maskCode(fileOf("a `x` b"))).toBe("a     b");
  });

  it("blanks a fenced block, keeping newlines", () => {
    expect(text.maskCode(fileOf("```\nx\n```"))).toBe("   \n \n   ");
  });
});
