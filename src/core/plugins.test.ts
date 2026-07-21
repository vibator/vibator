import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPlugins, mergeRules } from "./plugins.ts";
import type { AnyRule } from "./rule.ts";

/**
 * Builds a rule stub with the given id.
 *
 * @param id - The rule's identifier.
 * @returns A rule satisfying the contract structurally.
 */
function ruleNamed(id: string): AnyRule {
  return {
    id,
    title: id,
    docs: `rules/${id}.md`,
    scope: "file",
    defaultSeverity: "error",
    defaultInclude: ["**/*"],
    // biome-ignore lint/suspicious/noExplicitAny: a stub schema is enough here.
    optionsSchema: { safeParse: () => ({ success: true, data: {} }) } as any,
    checkFile: () => [],
  };
}

/**
 * Writes a plugin module to a throwaway directory.
 *
 * @param source - The module's contents.
 * @returns The absolute path of the written module.
 */
function pluginFile(source: string): string {
  const root = mkdtempSync(join(tmpdir(), "vibator-plugin-"));
  writeFileSync(join(root, "package.json"), '{"type":"module"}');
  const path = join(root, "rule.mjs");
  writeFileSync(path, source);
  return path;
}

describe("loadPlugins", () => {
  it("loads a single default-exported rule", async () => {
    const path = pluginFile(`
      export default {
        id: "custom", title: "Custom", docs: "custom.md", scope: "file",
        defaultSeverity: "error", defaultInclude: ["**/*"],
        optionsSchema: {}, checkFile: () => [],
      };
    `);
    const loaded = await loadPlugins("/", [path]);
    expect(loaded.map((rule) => rule.id)).toEqual(["custom"]);
  });

  it("loads an array of rules from one plugin", async () => {
    const path = pluginFile(`
      const make = (id) => ({
        id, title: id, docs: id + ".md", scope: "file",
        defaultSeverity: "error", defaultInclude: ["**/*"],
        optionsSchema: {}, checkFile: () => [],
      });
      export default [make("one"), make("two")];
    `);
    const loaded = await loadPlugins("/", [path]);
    expect(loaded.map((rule) => rule.id)).toEqual(["one", "two"]);
  });

  it("rejects a module exporting something that is not a rule", async () => {
    const path = pluginFile("export default { nope: true };");
    await expect(loadPlugins("/", [path])).rejects.toThrow(
      /must default-export a rule/,
    );
  });

  it("rejects a project-scoped rule with no check function", async () => {
    const path = pluginFile(`
      export default {
        id: "broken", title: "Broken", docs: "b.md", scope: "project",
        defaultSeverity: "error", defaultInclude: [], optionsSchema: {},
      };
    `);
    await expect(loadPlugins("/", [path])).rejects.toThrow(
      /must default-export a rule/,
    );
  });

  it("names the plugin it could not import", async () => {
    await expect(loadPlugins("/", ["./nowhere.js"])).rejects.toThrow(
      /Cannot load plugin "\.\/nowhere\.js"/,
    );
  });
});

describe("mergeRules", () => {
  it("appends plugin rules after the built-ins", () => {
    const merged = mergeRules([ruleNamed("built")], [ruleNamed("extra")]);
    expect(merged.map((rule) => rule.id)).toEqual(["built", "extra"]);
  });

  it("refuses a plugin shadowing a built-in id", () => {
    expect(() =>
      mergeRules([ruleNamed("max-lines")], [ruleNamed("max-lines")]),
    ).toThrow(/already taken by a built-in/);
  });

  it("refuses two plugins claiming the same id", () => {
    expect(() =>
      mergeRules([], [ruleNamed("same"), ruleNamed("same")]),
    ).toThrow(/same rule id/);
  });
});
