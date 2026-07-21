import { describe, expect, it } from "vitest";
import { z } from "zod";
import { type Config, resolveRules } from "./config.ts";
import type { AnyRule } from "./rule.ts";

/** A minimal rule to resolve config against. */
const sample: AnyRule = {
  id: "sample",
  title: "Sample",
  docs: "rules/sample.md",
  scope: "file",
  defaultSeverity: "error",
  defaultInclude: ["**/*.ts"],
  defaultExclude: ["**/*.test.ts"],
  optionsSchema: z.object({ limit: z.number().default(5) }),
  checkFile: () => [],
};

/**
 * Builds a config around a single rule entry.
 *
 * @param entry - The entry for the sample rule.
 * @returns A config object.
 */
function configWith(entry: unknown): Config {
  return { plugins: [], rules: { sample: entry }, guidelines: {} } as Config;
}

describe("resolveRules", () => {
  it("runs rules absent from config at their default severity", () => {
    const [resolved] = resolveRules(
      { plugins: [], rules: {}, guidelines: {} } as Config,
      [sample],
    );
    expect(resolved?.severity).toBe("error");
    expect(resolved?.include).toEqual(["**/*.ts"]);
  });

  it("accepts a bare severity string", () => {
    const [resolved] = resolveRules(configWith("warn"), [sample]);
    expect(resolved?.severity).toBe("warn");
  });

  it("drops rules switched off", () => {
    expect(resolveRules(configWith("off"), [sample])).toEqual([]);
  });

  it("applies rule option defaults when none are given", () => {
    const [resolved] = resolveRules(configWith("error"), [sample]);
    expect(resolved?.options).toEqual({ limit: 5 });
  });

  it("lets config override globs", () => {
    const [resolved] = resolveRules(
      configWith({ include: ["lib/**"], exclude: [] }),
      [sample],
    );
    expect(resolved?.include).toEqual(["lib/**"]);
  });

  it("rejects an unknown rule id rather than ignoring it", () => {
    const config = {
      plugins: [],
      rules: { nope: "error" },
      guidelines: {},
    } as Config;
    expect(() => resolveRules(config, [sample])).toThrow(/Unknown rule/);
  });

  it("rejects options that fail the rule's schema", () => {
    const config = configWith({ options: { limit: "many" } });
    expect(() => resolveRules(config, [sample])).toThrow(/Invalid options/);
  });

  it("attaches guideline documents naming the rule", () => {
    const config = {
      plugins: [],
      rules: {},
      guidelines: { "docs/style.md": ["sample"] },
    } as unknown as Config;
    const [resolved] = resolveRules(config, [sample]);
    expect(resolved?.guidelines).toEqual(["docs/style.md"]);
  });

  it("resolves an array entry to one instance per block", () => {
    const resolved = resolveRules(
      configWith([
        { include: ["src/**"], options: { limit: 5 } },
        { include: ["tests/**"], options: { limit: 10 } },
      ]),
      [sample],
    );
    expect(resolved).toHaveLength(2);
    expect(resolved[0]?.include).toEqual(["src/**"]);
    expect(resolved[1]?.options).toEqual({ limit: 10 });
  });

  it("drops only the blocks switched off inside an array entry", () => {
    const resolved = resolveRules(
      configWith([{ severity: "off" }, { severity: "warn" }]),
      [sample],
    );
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.severity).toBe("warn");
  });
});
