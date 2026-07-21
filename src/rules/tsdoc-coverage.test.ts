import ts from "typescript";
import { describe, expect, it } from "vitest";
import { analyseFile } from "./tsdoc/index.ts";

/** A file with one exported, documented function and one local, bare one. */
const MIXED = `/**
 * Greets.
 *
 * @param name - Who to greet.
 * @returns The greeting.
 */
export function greet(name: string): string {
  return \`hi \${name}\`;
}

function local(value: number): number {
  return value + 1;
}
`;

/**
 * Analyses source text with the given options.
 *
 * @param source - The file's contents.
 * @param overrides - Options overriding the rule's defaults.
 * @returns The violations found.
 */
function analyse(
  source: string,
  overrides: Partial<Parameters<typeof analyseFile>[3]> = {},
) {
  const sourceFile = ts.createSourceFile(
    "sample.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  return analyseFile(ts, sourceFile, "sample.ts", {
    requireOn: "all",
    requireParams: true,
    requireReturns: true,
    maxInlineCommentLines: 2,
    ...overrides,
  });
}

describe("tsdoc-coverage options", () => {
  it("holds every declaration to the bar under requireOn: all", () => {
    const violations = analyse(MIXED);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.symbol).toBe("local");
  });

  it("leaves module-local declarations alone under requireOn: exported", () => {
    expect(analyse(MIXED, { requireOn: "exported" })).toEqual([]);
  });

  it("can waive @param tags", () => {
    const undocumentedParams = `/** Adds. */
export function add(left: number, right: number): number {
  return left + right;
}
`;
    expect(analyse(undocumentedParams).length).toBeGreaterThan(0);
    expect(
      analyse(undocumentedParams, {
        requireParams: false,
        requireReturns: false,
      }),
    ).toEqual([]);
  });

  it("caps inline comment runs at the configured length", () => {
    const commented = `// one
// two
// three
export const value = 1;
`;
    expect(analyse(commented)).toHaveLength(1);
    expect(analyse(commented, { maxInlineCommentLines: 3 })).toEqual([]);
  });
});
