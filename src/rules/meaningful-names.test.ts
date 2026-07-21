import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createContext } from "../core/context.ts";
import { meaningfulNames } from "./meaningful-names.ts";

/** The rule's options with every default applied. */
const defaults = meaningfulNames.optionsSchema.parse({});

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
  return await meaningfulNames.check({
    files: ["a.ts"],
    options: defaults,
    context,
  });
}

describe("meaningful-names", () => {
  it("flags a denylisted filler name", async () => {
    const found = await run("const data = 1;\n");
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain('"data"');
    expect(found[0]?.line).toBe(1);
  });

  it("flags a name too short to carry meaning", async () => {
    const found = await run("function fn(ab: number) { return ab; }\n");
    expect(found).toHaveLength(2);
    expect(found[0]?.message).toContain('"fn"');
  });

  it("accepts allowlisted short names and underscore-prefixed ones", async () => {
    expect(await run("const id = 1;\nconst _unused = 2;\n")).toEqual([]);
  });

  it("accepts descriptive names", async () => {
    expect(await run("const parsedQuote = 1;\n")).toEqual([]);
  });

  it("leaves property names alone; they may mirror wire shapes", async () => {
    expect(await run("const shape = { res: 1 } as const;\n")).toEqual([]);
  });

  it("honours a reasoned ignore marker", async () => {
    const excused =
      "// vibator-ignore: published cyrb53 state name\nconst h1 = 1;\n";
    expect(await run(excused)).toEqual([]);
  });

  it("does not honour the bare marker", async () => {
    const bare = "// vibator-ignore:\nconst data = 1;\n";
    expect(await run(bare)).toHaveLength(1);
  });
});
