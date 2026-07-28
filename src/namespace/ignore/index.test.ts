import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";
import { File } from "../project/index.ts";
import { ignore } from "./index.ts";

const dir = mkdtempSync(join(tmpdir(), "vibator-ignore-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
let counter = 0;

/** Writes content to a temp file and returns the File over it. */
function fileOf(content: string): File {
  const path = join(dir, `x${counter++}.ts`);
  writeFileSync(path, content);
  return new File(path);
}

/** Finds the first node matching a predicate in a parsed source. */
function findNode(source: string, match: (node: ts.Node) => boolean): ts.Node {
  const sourceFile = ts.createSourceFile(
    "x.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  let found: ts.Node | undefined;
  const visit = (node: ts.Node): void => {
    if (!found && match(node)) found = node;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (!found) throw new Error("node not found");
  return found;
}

describe("ignore.line", () => {
  it("is true when the line above names the rule", () => {
    const file = fileOf("// vibator-ignore my-rule: legacy\nconst x = 1;");
    expect(ignore.line(file, 2, "my-rule")).toBe(true);
  });

  it("is false when the marker names a different rule", () => {
    const file = fileOf("// vibator-ignore other: legacy\nconst x = 1;");
    expect(ignore.line(file, 2, "my-rule")).toBe(false);
  });

  it("accepts a comma-separated list of rules", () => {
    const file = fileOf("// vibator-ignore a, my-rule: legacy\nconst x = 1;");
    expect(ignore.line(file, 2, "my-rule")).toBe(true);
  });

  it("treats the reason as optional", () => {
    const file = fileOf("// vibator-ignore my-rule\nconst x = 1;");
    expect(ignore.line(file, 2, "my-rule")).toBe(true);
  });

  it("is false when there is no marker", () => {
    const file = fileOf("const y = 0;\nconst x = 1;");
    expect(ignore.line(file, 2, "my-rule")).toBe(false);
  });

  it("is false on the first line, which has no line above", () => {
    const file = fileOf("const x = 1;");
    expect(ignore.line(file, 1, "my-rule")).toBe(false);
  });

  it("does not treat a file marker as a line marker", () => {
    const file = fileOf("// vibator-ignore-file my-rule: r\nconst x = 1;");
    expect(ignore.line(file, 2, "my-rule")).toBe(false);
  });
});

describe("ignore.file", () => {
  it("is true when a file marker names the rule", () => {
    const file = fileOf("// vibator-ignore-file my-rule: generated\nx();");
    expect(ignore.file(file, "my-rule")).toBe(true);
  });

  it("is false when the file marker names a different rule", () => {
    const file = fileOf("// vibator-ignore-file other: generated\nx();");
    expect(ignore.file(file, "my-rule")).toBe(false);
  });

  it("does not treat a line marker as a file marker", () => {
    const file = fileOf("// vibator-ignore my-rule: r\nx();");
    expect(ignore.file(file, "my-rule")).toBe(false);
  });
});

describe("ignore.node", () => {
  const call = (node: ts.Node) => ts.isCallExpression(node);

  it("is true when a marker sits above an enclosing class", () => {
    const node = findNode(
      "// vibator-ignore my-rule: legacy\nclass Foo {\n  bar() {\n    doThing();\n  }\n}",
      call,
    );
    expect(ignore.node(node, "my-rule")).toBe(true);
  });

  it("is true when a marker sits above an enclosing method", () => {
    const node = findNode(
      "class Foo {\n  // vibator-ignore my-rule: legacy\n  bar() {\n    doThing();\n  }\n}",
      call,
    );
    expect(ignore.node(node, "my-rule")).toBe(true);
  });

  it("is false when nothing is marked", () => {
    const node = findNode(
      "class Foo {\n  bar() {\n    doThing();\n  }\n}",
      call,
    );
    expect(ignore.node(node, "my-rule")).toBe(false);
  });

  it("is false when the marker names a different rule", () => {
    const node = findNode(
      "// vibator-ignore other: legacy\nclass Foo {\n  bar() {\n    doThing();\n  }\n}",
      call,
    );
    expect(ignore.node(node, "my-rule")).toBe(false);
  });
});
