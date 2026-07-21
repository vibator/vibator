import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { forEachParsedFile } from "../rules/ts-support.ts";
import { createContext } from "./context.ts";

/**
 * Builds a throwaway project holding one source file.
 *
 * @param source - The file's contents.
 * @returns The absolute root of the new tree.
 */
function projectWith(source: string): string {
  const root = mkdtempSync(join(tmpdir(), "vibator-"));
  writeFileSync(join(root, "a.ts"), source);
  return root;
}

describe("context.memo", () => {
  it("computes once per namespace and file", () => {
    const { context } = createContext(projectWith("export const a = 1;\n"));
    let calls = 0;
    const compute = () => {
      calls += 1;
      return { id: calls };
    };

    const first = context.memo("tree", "a.ts", compute);
    const second = context.memo("tree", "a.ts", compute);

    expect(second).toBe(first);
    expect(calls).toBe(1);
  });

  it("keeps namespaces apart for the same file", () => {
    const { context } = createContext(projectWith("export const a = 1;\n"));

    const tree = context.memo("tree", "a.ts", () => "tree");
    const tokens = context.memo("tokens", "a.ts", () => "tokens");

    expect(tree).toBe("tree");
    expect(tokens).toBe("tokens");
  });

  it("caches a value the compute function returned as undefined", () => {
    const { context } = createContext(projectWith("export const a = 1;\n"));
    let calls = 0;

    context.memo("tree", "a.ts", () => {
      calls += 1;
      return undefined;
    });
    context.memo("tree", "a.ts", () => {
      calls += 1;
      return undefined;
    });

    expect(calls).toBe(1);
  });
});

describe("forEachParsedFile", () => {
  it("parses a file once across rules sharing a context", () => {
    // Two rules walking the same file must receive the same tree: parsing per
    // rule is what turned one parse into three before the context memoized it.
    const { context } = createContext(projectWith("export const a = 1;\n"));
    const seen: ts.SourceFile[] = [];
    const record = (sourceFile: ts.SourceFile) => {
      seen.push(sourceFile);
      return [];
    };

    forEachParsedFile(context, ["a.ts"], ts, record);
    forEachParsedFile(context, ["a.ts"], ts, record);

    expect(seen).toHaveLength(2);
    expect(seen[1]).toBe(seen[0]);
  });

  it("parses each file with the script kind its extension implies", () => {
    // A .jsx file parsed as TypeScript reads its JSX as type assertions and
    // produces parse errors nothing surfaces.
    const root = mkdtempSync(join(tmpdir(), "vibator-"));
    writeFileSync(join(root, "a.jsx"), "const a = <div>hi</div>;\n");
    const { context } = createContext(root);
    const kinds: (ts.ScriptKind | undefined)[] = [];

    forEachParsedFile(context, ["a.jsx"], ts, (sourceFile) => {
      kinds.push((sourceFile as { scriptKind?: ts.ScriptKind }).scriptKind);
      return [];
    });

    expect(kinds).toEqual([ts.ScriptKind.JSX]);
  });
});
