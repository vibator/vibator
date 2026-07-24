import { describe, expect, it } from "vitest";
import { z } from "zod";
import { packageVersion } from "./core/package-root.ts";
import {
  BUILT_IN_RULES,
  createContext,
  defineRule,
  discover,
  hasLineIgnoreAbove,
  jsonReporter,
  prettyReporter,
  run,
} from "./index.ts";

describe("public API", () => {
  it("exports the embedding surface", () => {
    expect(typeof run).toBe("function");
    expect(typeof discover).toBe("function");
    expect(typeof createContext).toBe("function");
    expect(typeof jsonReporter).toBe("function");
    expect(typeof prettyReporter).toBe("function");
    expect(BUILT_IN_RULES.length).toBeGreaterThanOrEqual(11);
  });

  it("defineRule is an identity function that preserves the rule", () => {
    const rule = defineRule({
      id: "sample",
      title: "Sample",
      docs: "sample.md",
      scope: "file",
      defaultSeverity: "off",
      defaultInclude: [],
      optionsSchema: z.object({}),
      checkFile: () => [],
    });
    expect(rule.id).toBe("sample");
    expect(rule.scope).toBe("file");
  });

  it("exposes the shared line-ignore helper", () => {
    const lines = ["# vibator-ignore: templated", "password: X"];
    expect(hasLineIgnoreAbove(lines, 2, ["vibator-ignore"])).toBe(true);
    expect(hasLineIgnoreAbove(lines, 1, ["vibator-ignore"])).toBe(false);
  });

  it("reports the packaged version", () => {
    expect(packageVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
