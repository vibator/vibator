import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { vibator } from "../namespace/index.ts";
import { setRoot } from "../namespace/runtime.ts";
import { loadRules } from "./load-rules.ts";

/** The names each fixture module pushes when it is imported. */
declare global {
  var vibatorLoaded: string[] | undefined;
}

/**
 * A module that records its own import under a name.
 *
 * @param name - The name the module records.
 * @returns The module source.
 */
function recorder(name: string): string {
  return `globalThis.vibatorLoaded = [...(globalThis.vibatorLoaded ?? []), "${name}"];\nexport {};\n`;
}

describe("loadRules", () => {
  const dir = mkdtempSync(join(tmpdir(), "vibator-load-"));

  beforeAll(async () => {
    const folder = join(dir, ".vibator");
    mkdirSync(join(folder, "lib"), { recursive: true });
    writeFileSync(join(folder, "rule.ts"), recorder("rule"));
    writeFileSync(join(folder, "other.mjs"), recorder("other"));
    writeFileSync(join(folder, "rule.test.ts"), recorder("test"));
    writeFileSync(join(folder, "rule.spec.ts"), recorder("spec"));
    writeFileSync(join(folder, "types.d.ts"), "export {};\n");
    writeFileSync(join(folder, "lib", "helper.ts"), recorder("helper"));
    globalThis.vibatorLoaded = [];
    setRoot(dir);
    await loadRules({});
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("imports the rule modules at the top of .vibator/", () => {
    expect(globalThis.vibatorLoaded?.sort()).toEqual(["other", "rule"]);
  });
});

describe("loadRules plugins", () => {
  const dir = mkdtempSync(join(tmpdir(), "vibator-plugin-"));
  const namespaceModule = join(import.meta.dirname, "../namespace/index.ts");

  beforeAll(async () => {
    writeFileSync(
      join(dir, "plugin.ts"),
      `import { defineNamespace } from ${JSON.stringify(namespaceModule)};\n` +
        `defineNamespace("pluginAudit", { count: () => 3 });\n` +
        recorder("plugin"),
    );
    globalThis.vibatorLoaded = [];
    setRoot(dir);
    await loadRules({ plugins: ["./plugin.ts"] });
  });

  afterAll(() => {
    Reflect.deleteProperty(vibator, "pluginAudit");
    rmSync(dir, { recursive: true, force: true });
  });

  it("imports each plugin module", () => {
    expect(globalThis.vibatorLoaded).toEqual(["plugin"]);
  });

  it("adds the namespace a plugin defines to vibator", () => {
    const audit = Reflect.get(vibator, "pluginAudit") as { count(): number };
    expect(audit.count()).toBe(3);
  });
});
