import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createContext } from "../core/context.ts";
import { localeParity } from "./locale-parity.ts";

/**
 * Runs the rule against a throwaway locales tree.
 *
 * @param root - The project root holding the tree.
 * @param options - The rule's raw options.
 * @returns The diagnostics produced.
 */
async function run(root: string, options: unknown) {
  const { context } = createContext(root);
  return await localeParity.check({
    files: [],
    options: localeParity.optionsSchema.parse(options),
    context,
  });
}

describe("locale-parity, directory-per-locale", () => {
  it("flags a locale missing a key the source has", async () => {
    const root = mkdtempSync(join(tmpdir(), "vibator-"));
    mkdirSync(join(root, "locales", "en"), { recursive: true });
    mkdirSync(join(root, "locales", "de"), { recursive: true });
    writeFileSync(
      join(root, "locales", "en", "common.json"),
      '{"hello": "Hello", "bye": "Bye"}',
    );
    writeFileSync(
      join(root, "locales", "de", "common.json"),
      '{"hello": "Hallo"}',
    );

    const found = await run(root, { root: "locales" });
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain("bye");
  });
});

describe("locale-parity, file-per-locale", () => {
  /**
   * Builds a flat locales directory.
   *
   * @param catalogs - Locale code to JSON text.
   * @returns The project root.
   */
  function flatProject(catalogs: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), "vibator-"));
    mkdirSync(join(root, "locales"));
    Object.entries(catalogs).forEach(([locale, text]) => {
      writeFileSync(join(root, "locales", `${locale}.json`), text);
    });
    return root;
  }

  it("compares flat per-locale files against the source", async () => {
    const root = flatProject({
      en: '{"a": "A", "b": "B"}',
      fr: '{"a": "A"}',
    });
    const found = await run(root, {
      root: "locales",
      layout: "file-per-locale",
    });
    expect(found).toHaveLength(1);
    expect(found[0]?.file).toBe("locales/fr.json");
    expect(found[0]?.message).toContain("b");
  });

  it("flags keys a locale has that the source lacks", async () => {
    const root = flatProject({
      en: '{"a": "A"}',
      fr: '{"a": "A", "extra": "?"}',
    });
    const found = await run(root, {
      root: "locales",
      layout: "file-per-locale",
    });
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain("extra");
  });

  it("honours an explicit locale list", async () => {
    const root = flatProject({
      en: '{"a": "A"}',
      fr: "{}",
      "pt-BR": "{}",
    });
    const found = await run(root, {
      root: "locales",
      layout: "file-per-locale",
      locales: ["fr"],
    });
    expect(found).toHaveLength(1);
    expect(found[0]?.file).toBe("locales/fr.json");
  });
});

describe("locale-parity, misconfiguration", () => {
  it("reports a readable finding when the root does not exist", async () => {
    const root = mkdtempSync(join(tmpdir(), "vibator-"));
    const found = await run(root, { root: "nowhere" });
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain("nowhere");
    expect(found[0]?.fix).toBeTruthy();
  });
});
