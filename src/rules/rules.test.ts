import { describe, expect, it } from "vitest";
import { createContext } from "../core/context.ts";
import { maxFileSize } from "./max-file-size.ts";
import { noConflictMarkers } from "./no-conflict-markers.ts";

/** A context rooted anywhere; the file rules under test never read from disk. */
const { context } = createContext(process.cwd());

/** The file rules exercised here. */
type FileRuleUnderTest = typeof maxFileSize | typeof noConflictMarkers;

/**
 * Runs a file rule over literal content.
 *
 * @param rule - The rule to exercise.
 * @param content - The file's bytes, as text.
 * @param options - The rule's options.
 * @returns The diagnostics produced.
 */
function runFileRule(
  rule: FileRuleUnderTest,
  content: string,
  options: unknown,
) {
  return rule.checkFile({
    file: "sample.ts",
    bytes: Buffer.from(content),
    // biome-ignore lint/suspicious/noExplicitAny: options differ per rule.
    options: options as any,
    context,
  });
}

describe("no-conflict-markers", () => {
  it("flags a conflicted file at the first marker", () => {
    const conflicted = [
      "intro",
      "<<<<<<< HEAD",
      "ours",
      "=======",
      "theirs",
      ">>>>>>> other",
      "",
    ].join("\n");
    const found = runFileRule(noConflictMarkers, conflicted, {});
    expect(found).toHaveLength(1);
    expect(found[0]?.line).toBe(2);
  });

  it("accepts a clean file", () => {
    expect(runFileRule(noConflictMarkers, "const total = 1;\n", {})).toEqual(
      [],
    );
  });

  it("ignores a row of angle brackets in prose", () => {
    const prose = "see <<<<<<<< for details\n";
    expect(runFileRule(noConflictMarkers, prose, {})).toEqual([]);
  });

  it("catches the diff3 base marker", () => {
    const withBase = ["a", "||||||| base", "b", ""].join("\n");
    expect(runFileRule(noConflictMarkers, withBase, {})).toHaveLength(1);
  });

  it("skips binary content rather than reporting noise", () => {
    const binary = `a\0<<<<<<< HEAD\n`;
    expect(runFileRule(noConflictMarkers, binary, {})).toEqual([]);
  });
});

describe("max-file-size", () => {
  it("flags a file over the byte budget", () => {
    const found = runFileRule(maxFileSize, "x".repeat(2048), { maxKb: 1 });
    expect(found).toHaveLength(1);
  });

  it("accepts a file within the budget", () => {
    expect(runFileRule(maxFileSize, "x".repeat(512), { maxKb: 1 })).toEqual([]);
  });
});
