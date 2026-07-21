import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { createContext } from "../core/context.ts";
import { analyseFile } from "./tsdoc/index.ts";
import { tsdocCoverage } from "./tsdoc-coverage.ts";

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

describe("tsdoc-coverage analysis forms", () => {
  it("checks const-bound arrow functions, attaching docs to the statement", () => {
    const bound = "const compute = (value: number): number => value + 1;\n";
    const violations = analyse(bound);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.symbol).toBe("compute");
  });

  it("checks class members under their class-qualified name", () => {
    const withClass = [
      "/** A parser. */",
      "export class Parser {",
      "  parse(text: string): string {",
      "    return text;",
      "  }",
      "}",
      "",
    ].join("\n");
    const violations = analyse(withClass);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.symbol).toBe("Parser.parse");
  });

  it("asks for @param and @returns when a doc block exists but is incomplete", () => {
    const incomplete = [
      "/** Adds. */",
      "export function add(left: number, right: number): number {",
      "  return left + right;",
      "}",
      "",
    ].join("\n");
    const problems = analyse(incomplete).map((entry) => entry.problem);
    expect(problems).toContain('missing @param for "left"');
    expect(problems).toContain('missing @param for "right"');
    expect(problems).toContain("missing @returns");
  });

  it("tells a `//` comment standing in for a doc apart from no comment", () => {
    const commented =
      "// adds one\nexport function increment(value: number): number {\n  return value + 1;\n}\n";
    const [violation] = analyse(commented);
    expect(violation?.problem).toContain("replace the `//` comment");
  });

  it("flags members documented with `//` instead of TSDoc", () => {
    const memberComment = [
      "/** A shape. */",
      "export interface Shape {",
      "  // the width",
      "  width: number;",
      "}",
      "",
    ].join("\n");
    const [violation] = analyse(memberComment);
    expect(violation?.problem).toContain("not a `//` comment");
  });
});

describe("tsdoc-coverage rule", () => {
  it("maps violations onto the three diagnostic fields", async () => {
    const root = mkdtempSync(join(tmpdir(), "vibator-"));
    writeFileSync(
      join(root, "a.ts"),
      "export function bare(value: number): number {\n  return value;\n}\n",
    );
    const { context } = createContext(root);

    const found = await tsdocCoverage.check({
      files: ["a.ts"],
      options: tsdocCoverage.optionsSchema.parse({}),
      context,
    });

    expect(found).toHaveLength(1);
    expect(found[0]?.file).toBe("a.ts");
    expect(found[0]?.message).toContain("bare");
    expect(found[0]?.expected).toBeTruthy();
    expect(found[0]?.fix).toBeTruthy();
  });
});
