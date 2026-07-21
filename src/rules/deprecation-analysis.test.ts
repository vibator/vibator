import ts from "typescript";
import { describe, expect, it } from "vitest";
import { deprecatedUse } from "./deprecation-analysis.ts";

/**
 * Builds a type-checked program over in-memory sources.
 *
 * @param files - Filenames mapped to their contents.
 * @returns The program and its checker.
 */
function programOf(files: Record<string, string>) {
  const host: ts.CompilerHost = {
    fileExists: (name) => name in files || ts.sys.fileExists(name),
    readFile: (name) => files[name] ?? ts.sys.readFile(name),
    getSourceFile: (name, target) => {
      const text = files[name] ?? ts.sys.readFile(name);
      return text === undefined
        ? undefined
        : ts.createSourceFile(name, text, target, true);
    },
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    writeFile: () => {},
    getCurrentDirectory: () => "/",
    getCanonicalFileName: (name) => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
  };

  const program = ts.createProgram(Object.keys(files), {}, host);
  return { program, checker: program.getTypeChecker() };
}

/**
 * Collects every deprecated usage the analysis reports in one file.
 *
 * @param files - The sources to compile.
 * @param entry - Which file to walk.
 * @returns The offending identifier names.
 */
function usagesIn(files: Record<string, string>, entry: string): string[] {
  const { program, checker } = programOf(files);
  const sourceFile = program.getSourceFile(entry);
  if (!sourceFile) throw new Error(`no source file: ${entry}`);

  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    const used = deprecatedUse(ts, checker, node);
    if (used) {
      const line =
        sourceFile.getLineAndCharacterOfPosition(used.node.getStart()).line + 1;
      found.push(`${used.node.text}:${line}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

describe("deprecatedUse", () => {
  it("reports a call to a deprecated function declared in the same file", () => {
    const found = usagesIn(
      {
        "/a.ts":
          "/** @deprecated Use fresh(). */\nexport function stale() {}\nstale();\n",
      },
      "/a.ts",
    );
    expect(found).toContain("stale:3");
  });

  it("follows an import alias to the deprecated declaration", () => {
    // The regression this locks in: an imported symbol resolves to the local
    // import binding, whose declaration carries no tag. Without unwrapping the
    // alias, every deprecated import goes silently unreported.
    const found = usagesIn(
      {
        "/lib.ts":
          "/** @deprecated Use fresh(). */\nexport function stale() {}\n",
        "/main.ts": 'import { stale } from "./lib.ts";\nstale();\n',
      },
      "/main.ts",
    );
    expect(found).toContain("stale:2");
  });

  it("reports a deprecated symbol referenced without being called", () => {
    const found = usagesIn(
      {
        "/lib.ts": "/** @deprecated */\nexport function stale() {}\n",
        "/main.ts": 'import { stale } from "./lib.ts";\nconst held = stale;\n',
      },
      "/main.ts",
    );
    expect(found).toContain("stale:2");
  });

  it("leaves a current function alone", () => {
    const found = usagesIn(
      {
        "/lib.ts": "export function fresh() {}\n",
        "/main.ts": 'import { fresh } from "./lib.ts";\nfresh();\n',
      },
      "/main.ts",
    );
    expect(found).toEqual([]);
  });

  it("judges the call by the overload actually resolved", () => {
    // Only the string overload is deprecated, and the call selects the number
    // one. The call must not report; this is what stops every DOM call with a
    // deprecated tag-name overload from being flagged.
    const source = [
      "/** @deprecated */",
      "export function pick(value: string): void;",
      "export function pick(value: number): void;",
      "export function pick(value: unknown): void {}",
    ].join("\n");
    const found = usagesIn(
      {
        "/lib.ts": source,
        "/main.ts": 'import { pick } from "./lib.ts";\npick(1);\n',
      },
      "/main.ts",
    );
    expect(found).not.toContain("pick:2");
  });

  it("reports the import of a partly deprecated symbol", () => {
    // Known limitation, not a goal: a symbol's tags are merged across its
    // overloads, so importing one whose *any* overload is deprecated reports
    // the import line even when only current overloads are called. Recorded
    // here so a change in this behaviour is a deliberate one.
    const source = [
      "/** @deprecated */",
      "export function pick(value: string): void;",
      "export function pick(value: number): void;",
      "export function pick(value: unknown): void {}",
    ].join("\n");
    const found = usagesIn(
      {
        "/lib.ts": source,
        "/main.ts": 'import { pick } from "./lib.ts";\npick(1);\n',
      },
      "/main.ts",
    );
    expect(found).toContain("pick:1");
  });

  it("reports a deprecated option written in a config object", () => {
    const source = [
      "export interface Options {",
      "  /** @deprecated Use codeSplitting. */",
      "  advancedChunks?: boolean;",
      "  codeSplitting?: boolean;",
      "}",
      "export function configure(options: Options) { return options; }",
    ].join("\n");
    const found = usagesIn(
      {
        "/lib.ts": source,
        "/main.ts":
          'import { configure } from "./lib.ts";\nconfigure({ advancedChunks: true });\n',
      },
      "/main.ts",
    );
    expect(found).toContain("advancedChunks:2");
  });

  it("does not report a deprecated declaration at its own site", () => {
    const found = usagesIn(
      { "/a.ts": "/** @deprecated */\nexport function stale() {}\n" },
      "/a.ts",
    );
    expect(found).toEqual([]);
  });
});
