import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createContext } from "../core/context.ts";
import { noDeprecatedApis } from "./no-deprecated-apis.ts";

/** A minimal tsconfig covering the fixture's single file. */
const TSCONFIG = JSON.stringify({
  compilerOptions: { strict: true, skipLibCheck: true },
  include: ["a.ts"],
});

/**
 * Runs the rule against a one-file TypeScript project.
 *
 * @param source - The file's contents.
 * @returns The diagnostics produced.
 */
async function run(source: string) {
  const root = mkdtempSync(join(tmpdir(), "vibator-"));
  writeFileSync(join(root, "tsconfig.json"), TSCONFIG);
  writeFileSync(join(root, "a.ts"), source);
  const { context } = createContext(root);
  return await noDeprecatedApis.check({
    files: ["a.ts"],
    options: noDeprecatedApis.optionsSchema.parse({}),
    context,
  });
}

describe("no-deprecated-apis", () => {
  it("flags a call into a deprecated declaration, naming the replacement", async () => {
    const source = [
      "/** @deprecated Use newThing instead. */",
      "export function oldThing(): void {}",
      "export function newThing(): void {}",
      "oldThing();",
      "",
    ].join("\n");

    const found = await run(source);
    expect(found).toHaveLength(1);
    expect(found[0]?.line).toBe(4);
    expect(found[0]?.message).toBe("oldThing is deprecated");
    expect(found[0]?.fix).toContain("Use newThing instead.");
  });

  it("accepts calls into current declarations", async () => {
    const source = [
      "export function currentThing(): void {}",
      "currentThing();",
      "",
    ].join("\n");
    expect(await run(source)).toEqual([]);
  });

  it("returns nothing when no files are in scope, without building a program", async () => {
    const root = mkdtempSync(join(tmpdir(), "vibator-"));
    const { context } = createContext(root);
    const found = await noDeprecatedApis.check({
      files: [],
      options: noDeprecatedApis.optionsSchema.parse({}),
      context,
    });
    expect(found).toEqual([]);
  });
});
