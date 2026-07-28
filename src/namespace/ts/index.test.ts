import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import tsLib from "typescript";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { File } from "../project/index.ts";
import { setRoot } from "../runtime.ts";
import { ts } from "./index.ts";

const parseDir = mkdtempSync(join(tmpdir(), "vibator-ts-parse-"));
afterAll(() => rmSync(parseDir, { recursive: true, force: true }));
let counter = 0;

/** Writes content to a temp file with the given extension, returns the File. */
function fileOf(ext: string, content: string): File {
  const path = join(parseDir, `x${counter++}${ext}`);
  writeFileSync(path, content);
  return new File(path);
}

describe("ts.parse", () => {
  it("flattens nodes with their 1-based lines", () => {
    const ast = ts.parse(fileOf(".ts", "const x = 1;\nconst y = 2;"));
    const y = ast.nodes.find(
      (cursor) => tsLib.isIdentifier(cursor.node) && cursor.node.text === "y",
    );
    expect(y?.line).toBe(2);
  });

  it("resolves a line from an offset", () => {
    const ast = ts.parse(fileOf(".ts", "const x = 1;\nconst y = 2;"));
    expect(ast.lineAt(13)).toBe(2);
  });

  it("exposes the source file", () => {
    const ast = ts.parse(fileOf(".ts", "const x = 1;"));
    expect(ast.source.statements.length).toBe(1);
  });

  it("parses TSX by extension", () => {
    const ast = ts.parse(fileOf(".tsx", "const el = <div>{x}</div>;"));
    expect(ast.nodes.some((cursor) => tsLib.isJsxElement(cursor.node))).toBe(
      true,
    );
  });
});

describe("ts.program", () => {
  const dir = mkdtempSync(join(tmpdir(), "vibator-ts-"));

  const fileFor = (path: string): File => new File(path);

  beforeAll(() => {
    writeFileSync(
      join(dir, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { strict: true }, files: ["a.ts"] }),
    );
    writeFileSync(join(dir, "a.ts"), "export const count: number = 3;");
    setRoot(dir);
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("includes the project files", () => {
    const program = ts.program(fileFor(join(dir, "tsconfig.json")));
    expect(program.files.paths()).toContain(
      join(dir, "a.ts").replaceAll("\\", "/"),
    );
  });

  it("resolves types through the checker", () => {
    const program = ts.program(fileFor(join(dir, "tsconfig.json")));
    const ast = program.ast(fileFor(join(dir, "a.ts")));
    const count = ast.nodes.find(
      (cursor) =>
        tsLib.isIdentifier(cursor.node) && cursor.node.text === "count",
    );
    if (!count) throw new Error("count not found");
    const type = program.checker.getTypeAtLocation(count.node);
    expect(program.checker.typeToString(type)).toBe("number");
  });
});
