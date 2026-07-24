import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveConfigChain } from "./config-extends.ts";

/** Directories to remove once the suite has run. */
const created: string[] = [];

/**
 * Writes a throwaway directory of config files.
 *
 * @param files - Filename to contents, each serialised as JSON.
 * @returns The absolute directory holding them.
 */
function fixture(files: Record<string, unknown>): string {
  const directory = mkdtempSync(join(tmpdir(), "vibator-extends-"));
  created.push(directory);
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(join(directory, name), JSON.stringify(contents));
  }
  return directory;
}

afterEach(() => {
  for (const directory of created.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("resolveConfigChain", () => {
  it("returns the file itself when it extends nothing", () => {
    const directory = fixture({ "vibator.json": { rules: { a: "warn" } } });
    expect(resolveConfigChain(join(directory, "vibator.json")).rules).toEqual({
      a: "warn",
    });
  });

  it("inherits options through a bare severity, as Biome does", () => {
    const directory = fixture({
      "base.json": {
        rules: {
          "max-file-size": { options: { maxKb: 400 }, include: ["src/**"] },
        },
      },
      "vibator.json": {
        extends: "./base.json",
        rules: { "max-file-size": "warn" },
      },
    });
    const merged = resolveConfigChain(join(directory, "vibator.json"));
    expect(merged.rules?.["max-file-size"]).toEqual({
      severity: "warn",
      include: ["src/**"],
      options: { maxKb: 400 },
    });
  });

  it("replaces option arrays instead of concatenating them", () => {
    const directory = fixture({
      "base.json": { rules: { names: { options: { allow: ["id", "db"] } } } },
      "vibator.json": {
        extends: "./base.json",
        rules: { names: { options: { allow: ["ok"] } } },
      },
    });
    const merged = resolveConfigChain(join(directory, "vibator.json"));
    expect(merged.rules?.names).toEqual({ options: { allow: ["ok"] } });
  });

  it("lets a later extends entry win over an earlier one", () => {
    const directory = fixture({
      "first.json": { rules: { a: { options: { max: 100, keep: 1 } } } },
      "second.json": { rules: { a: { options: { max: 200 } } } },
      "vibator.json": { extends: ["./first.json", "./second.json"] },
    });
    const merged = resolveConfigChain(join(directory, "vibator.json"));
    expect(merged.rules?.a).toEqual({ options: { max: 200, keep: 1 } });
  });

  it("replaces wholesale when either side uses the multi-block form", () => {
    const directory = fixture({
      "base.json": { rules: { a: { options: { max: 400 } } } },
      "vibator.json": {
        extends: "./base.json",
        rules: { a: [{ include: ["src/**"] }, { include: ["tests/**"] }] },
      },
    });
    const merged = resolveConfigChain(join(directory, "vibator.json"));
    expect(merged.rules?.a).toEqual([
      { include: ["src/**"] },
      { include: ["tests/**"] },
    ]);
  });

  it("resolves an inherited docs path against the config that declared it", () => {
    const directory = fixture({
      "base.json": { rules: { a: { docs: "guides/length.md" } } },
      "vibator.json": { extends: "./base.json" },
    });
    const merged = resolveConfigChain(join(directory, "vibator.json"));
    expect(merged.rules?.a).toEqual({
      docs: resolve(directory, "guides/length.md"),
    });
  });

  it("resolves inherited guideline document keys the same way", () => {
    const directory = fixture({
      "base.json": { guidelines: { "style.md": ["a"] } },
      "vibator.json": { extends: "./base.json" },
    });
    const merged = resolveConfigChain(join(directory, "vibator.json"));
    expect(merged.guidelines).toEqual({
      [resolve(directory, "style.md")]: ["a"],
    });
  });

  it("leaves the extending file's own paths alone", () => {
    const directory = fixture({
      "base.json": { rules: {} },
      "vibator.json": {
        extends: "./base.json",
        rules: { a: { docs: "docs/mine.md" } },
      },
    });
    const merged = resolveConfigChain(join(directory, "vibator.json"));
    expect(merged.rules?.a).toEqual({ docs: "docs/mine.md" });
  });

  it("unions guideline rule ids per document", () => {
    const directory = fixture({
      "base.json": { guidelines: { "/abs/style.md": ["a", "b"] } },
      "vibator.json": {
        extends: "./base.json",
        guidelines: { "/abs/style.md": ["b", "c"] },
      },
    });
    const merged = resolveConfigChain(join(directory, "vibator.json"));
    expect(merged.guidelines?.["/abs/style.md"]).toEqual(["a", "b", "c"]);
  });

  it("concatenates plugins, parent first, without duplicates", () => {
    const directory = fixture({
      "base.json": { plugins: ["pkg-one"] },
      "vibator.json": {
        extends: "./base.json",
        plugins: ["pkg-one", "pkg-two"],
      },
    });
    const merged = resolveConfigChain(join(directory, "vibator.json"));
    expect(merged.plugins).toEqual(["pkg-one", "pkg-two"]);
  });

  it("carries recommended through a config that extends nothing", () => {
    const directory = fixture({ "vibator.json": { recommended: false } });
    expect(
      resolveConfigChain(join(directory, "vibator.json")).recommended,
    ).toBe(false);
  });

  it("inherits recommended, and lets the nearest config win", () => {
    const directory = fixture({
      "base.json": { recommended: false },
      "inherits.json": { extends: "./base.json" },
      "overrides.json": { extends: "./base.json", recommended: true },
    });
    expect(
      resolveConfigChain(join(directory, "inherits.json")).recommended,
    ).toBe(false);
    expect(
      resolveConfigChain(join(directory, "overrides.json")).recommended,
    ).toBe(true);
  });

  it("does not inherit root, which describes only the file stating it", () => {
    const directory = fixture({
      "base.json": { root: "packages/api" },
      "vibator.json": { extends: "./base.json" },
    });
    expect(
      resolveConfigChain(join(directory, "vibator.json")).root,
    ).toBeUndefined();
  });

  it("reports a cycle instead of recursing forever", () => {
    const directory = fixture({
      "a.json": { extends: "./b.json" },
      "b.json": { extends: "./a.json" },
    });
    expect(() => resolveConfigChain(join(directory, "a.json"))).toThrow(
      /extends itself/,
    );
  });

  it("names the file when an extends target is missing", () => {
    const directory = fixture({ "vibator.json": { extends: "./gone.json" } });
    expect(() => resolveConfigChain(join(directory, "vibator.json"))).toThrow(
      /does not exist/,
    );
  });

  it("names the specifier when no package provides it", () => {
    const directory = fixture({
      "vibator.json": { extends: "@nobody/nothing-here" },
    });
    expect(() => resolveConfigChain(join(directory, "vibator.json"))).toThrow(
      /no installed package provides/,
    );
  });

  it("reports which file holds invalid JSON", () => {
    const directory = fixture({ "vibator.json": {} });
    writeFileSync(join(directory, "vibator.json"), "{ not json");
    expect(() => resolveConfigChain(join(directory, "vibator.json"))).toThrow(
      /Invalid JSON in/,
    );
  });
});
