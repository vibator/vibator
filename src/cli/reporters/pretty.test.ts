import { describe, expect, it } from "vitest";
import type { Finding } from "../../engine/finding.ts";
import { pretty } from "./pretty.ts";

const findings: Finding[] = [
  {
    ruleId: "no-deprecated-apis",
    severity: "error",
    file: "src/a.ts",
    line: 3,
    column: 5,
    message: "foo is deprecated",
  },
  { ruleId: "locale-parity", severity: "warn", message: "keys missing" },
];

describe("pretty", () => {
  it("includes the location, severity, rule, and message", () => {
    const output = pretty(findings);
    expect(output).toContain("src/a.ts:3:5");
    expect(output).toContain("error");
    expect(output).toContain("no-deprecated-apis");
    expect(output).toContain("foo is deprecated");
  });

  it("shows a project-level finding without a location", () => {
    const output = pretty(findings);
    expect(output).toContain("locale-parity");
    expect(output).toContain("keys missing");
  });

  it("reports when there are no findings", () => {
    expect(pretty([])).toMatch(/no findings/i);
  });

  it("shows the snippet and guideline under a finding", () => {
    const output = pretty([
      {
        ruleId: "demo",
        severity: "error",
        file: "src/a.ts",
        line: 2,
        message: "bad",
        snippet: "  1 | a\n> 2 | b",
        docs: "/abs/demo.md",
      },
    ]);
    expect(output).toContain("  1 | a\n> 2 | b");
    expect(output).toContain("guideline: /abs/demo.md");
  });
});
