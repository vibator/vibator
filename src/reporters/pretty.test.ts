import { afterEach, describe, expect, it, vi } from "vitest";
import type { RuleResult, RunEvent } from "../core/engine.ts";
import { prettyReporter } from "./pretty.ts";

/** A finished rule with one error-severity finding. */
const RULE_RESULT: RuleResult = {
  ruleId: "max-lines",
  title: "No source file longer than the budget",
  files: 3,
  durationMs: 12,
  diagnostics: [
    {
      file: "src/big.ts",
      line: 401,
      message: "too long",
      expected: "shorter",
      fix: "split it",
      ruleId: "max-lines",
      severity: "error",
      docs: [{ path: "rules/max-lines.md" }, { path: "CLAUDE.md" }],
      snippet: "> 401 | const x = 1;",
    },
  ],
};

/**
 * Feeds a full event sequence to the reporter and captures its output.
 *
 * @param result - The rule result the run finishes with.
 * @returns Everything written to stdout and stderr, concatenated.
 */
function render(result: RuleResult): string {
  const written: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    written.push(String(chunk));
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    written.push(String(chunk));
    return true;
  });

  const report = prettyReporter();
  const events: RunEvent[] = [
    { kind: "run:start", rules: 1 },
    { kind: "rule:start", ruleId: result.ruleId, title: result.title },
    { kind: "rule:discovered", ruleId: result.ruleId, files: result.files },
    { kind: "rule:progress", ruleId: result.ruleId, done: 1, total: 3 },
    { kind: "rule:done", ruleId: result.ruleId, result },
    {
      kind: "run:done",
      result: {
        rules: [result],
        errors: result.diagnostics.length,
        warnings: 0,
        durationMs: 20,
      },
    },
  ];
  events.forEach(report);
  return written.join("");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("prettyReporter", () => {
  it("prints the finding with location, snippet, expectation and fix", () => {
    const output = render(RULE_RESULT);
    expect(output).toContain("src/big.ts:401");
    expect(output).toContain("too long");
    expect(output).toContain("> 401 | const x = 1;");
    expect(output).toContain("expected: shorter");
    expect(output).toContain("fix: split it");
  });

  it("lists every guideline path under the findings", () => {
    expect(render(RULE_RESULT)).toContain("rules/max-lines.md, CLAUDE.md");
  });

  it("prints the closing error count", () => {
    expect(render(RULE_RESULT)).toContain("1 error");
  });

  it("reports a crashed rule as failed rather than clean", () => {
    const crashed: RuleResult = {
      ...RULE_RESULT,
      diagnostics: [],
      error: "generator exploded",
    };
    const output = render(crashed);
    expect(output).toContain("rule failed");
    expect(output).toContain("generator exploded");
  });

  it("prints no errors on a clean run", () => {
    expect(render({ ...RULE_RESULT, diagnostics: [] })).toContain("no errors");
  });
});
