import { afterEach, describe, expect, it } from "vitest";
import { vibator } from "../namespace/index.ts";
import { defineRule, resetRules } from "../rules/define-rule.ts";
import { runRule } from "./index.ts";

afterEach(() => resetRules());

describe("runRule", () => {
  it("runs a rule over in-memory files and returns its findings", async () => {
    const rule = defineRule({
      id: "no-foo",
      title: "No foo",
      check: () =>
        vibator.text
          .search(vibator.project.files.match("**/*.ts"), /foo/)
          .map((hit) => ({ ...hit, message: "foo" })),
    });
    const findings = await runRule(rule, {
      files: { "src/a.ts": "const foo = 1;", "src/b.ts": "ok", "c.md": "foo" },
    });
    expect(findings).toEqual([
      {
        ruleId: "no-foo",
        severity: "error",
        file: "src/a.ts",
        line: 1,
        column: 7,
        message: "foo",
      },
    ]);
  });

  it("passes options to the rule", async () => {
    const { z } = await import("zod");
    const rule = defineRule({
      id: "echo",
      title: "Echo",
      options: z.object({ word: z.string().default("none") }),
      check: ({ word }) => [{ message: word }],
    });
    expect(await runRule(rule, { options: { word: "hi" } })).toEqual([
      { ruleId: "echo", severity: "error", message: "hi" },
    ]);
  });

  it("runs only the given rule", async () => {
    defineRule({
      id: "other",
      title: "Other",
      check: () => [{ message: "x" }],
    });
    const rule = defineRule({ id: "quiet", title: "Quiet", check: () => [] });
    expect(await runRule(rule)).toEqual([]);
  });
});
