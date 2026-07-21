import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createContext } from "../core/context.ts";
import { preferArrayMethods } from "./prefer-array-methods.ts";

/** The rule's options with every default applied. */
const defaults = preferArrayMethods.optionsSchema.parse({});

/**
 * Runs the rule over one source file.
 *
 * @param source - The file's contents.
 * @returns The diagnostics produced.
 */
async function run(source: string) {
  const root = mkdtempSync(join(tmpdir(), "vibator-"));
  writeFileSync(join(root, "a.ts"), source);
  const { context } = createContext(root);
  return await preferArrayMethods.check({
    files: ["a.ts"],
    options: defaults,
    context,
  });
}

describe("prefer-array-methods", () => {
  it("flags a single-statement for-of loop", async () => {
    const found = await run(
      "for (const item of items) {\n  handle(item);\n}\n",
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.line).toBe(1);
    expect(found[0]?.fix).toContain("forEach");
  });

  it("flags a bare single-statement loop body", async () => {
    expect(await run("for (const item of items) handle(item);\n")).toHaveLength(
      1,
    );
  });

  it("leaves loops with break alone", async () => {
    const withBreak = "for (const item of items) {\n  if (item) break;\n}\n";
    expect(await run(withBreak)).toEqual([]);
  });

  it("leaves loops with await alone", async () => {
    const withAwait =
      "async function go() {\n  for (const item of items) {\n    await handle(item);\n  }\n}\n";
    expect(await run(withAwait)).toEqual([]);
  });

  it("leaves multi-statement bodies alone", async () => {
    const multi =
      "for (const item of items) {\n  prepare(item);\n  handle(item);\n}\n";
    expect(await run(multi)).toEqual([]);
  });

  it("does not blame a break inside a nested function on the loop", async () => {
    const nested =
      "for (const item of items) {\n  register(() => { while (true) { break; } });\n}\n";
    expect(await run(nested)).toHaveLength(1);
  });

  it("honours a reasoned ignore marker", async () => {
    const excused =
      "// vibator-ignore: hot path, measured\nfor (const item of items) handle(item);\n";
    expect(await run(excused)).toEqual([]);
  });
});
