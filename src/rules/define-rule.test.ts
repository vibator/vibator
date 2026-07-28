import { afterEach, describe, expect, it } from "vitest";
import {
  definedRules,
  defineRule,
  type Rule,
  resetRules,
} from "./define-rule.ts";
import type { Report } from "./report.ts";

/** Builds a minimal rule for a test. */
function makeRule(id: string): Rule {
  return {
    id,
    title: id,
    docs: `${id}.md`,
    check: (): Report => ({ diagnostics: [] }),
  };
}

afterEach(() => resetRules());

describe("defineRule", () => {
  it("registers the rule and returns it", () => {
    const rule = defineRule(makeRule("a"));
    expect(rule.id).toBe("a");
    expect(definedRules().map((registered) => registered.id)).toEqual(["a"]);
  });

  it("registers multiple rules", () => {
    defineRule(makeRule("a"));
    defineRule(makeRule("b"));
    expect(
      definedRules()
        .map((registered) => registered.id)
        .sort(),
    ).toEqual(["a", "b"]);
  });

  it("throws on a duplicate id before running anything", () => {
    defineRule(makeRule("a"));
    expect(() => defineRule(makeRule("a"))).toThrow(/duplicate/i);
  });
});
