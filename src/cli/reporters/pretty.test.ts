import { afterEach, describe, expect, it, vi } from "vitest";
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

  describe("colors", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("leaves the output plain when the terminal takes no colors", () => {
      vi.stubEnv("FORCE_COLOR", undefined);
      vi.stubEnv("NO_COLOR", "1");
      expect(pretty(findings)).not.toContain("\u001b[");
    });

    it("paints an error red and a warning yellow", () => {
      vi.stubEnv("FORCE_COLOR", "1");
      const output = pretty(findings);
      expect(output).toContain("\u001b[31merror\u001b[39m");
      expect(output).toContain("\u001b[33mwarn\u001b[39m");
    });

    it("paints the summary red while an error stands", () => {
      vi.stubEnv("FORCE_COLOR", "1");
      expect(pretty(findings)).toContain(
        "\u001b[31m1 error(s), 1 warning(s)\u001b[39m",
      );
    });

    it("paints the summary yellow when only warnings stand", () => {
      vi.stubEnv("FORCE_COLOR", "1");
      const output = pretty([
        { ruleId: "locale-parity", severity: "warn", message: "keys missing" },
      ]);
      expect(output).toContain("\u001b[33m0 error(s), 1 warning(s)\u001b[39m");
    });

    it("paints a clean run green", () => {
      vi.stubEnv("FORCE_COLOR", "1");
      expect(pretty([])).toContain("\u001b[32mNo findings.\u001b[39m");
    });

    it("paints the location cyan and the rule id dim", () => {
      vi.stubEnv("FORCE_COLOR", "1");
      const output = pretty(findings);
      expect(output).toContain("\u001b[36msrc/a.ts:3:5\u001b[39m");
      expect(output).toContain("\u001b[2mno-deprecated-apis\u001b[22m");
    });

    it("dims the context lines of a snippet and leaves the marked ones", () => {
      vi.stubEnv("FORCE_COLOR", "1");
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
      expect(output).toContain("\u001b[2m  1 | a\u001b[22m");
      expect(output).toContain("> 2 | b");
      expect(output).not.toContain("\u001b[2m> 2 | b");
      expect(output).toContain("\u001b[2mguideline: /abs/demo.md\u001b[22m");
    });
  });
});
