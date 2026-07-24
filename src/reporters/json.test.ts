import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunResult } from "../core/engine.ts";
import { jsonReporter } from "./json.ts";

/** A minimal finished run with one finding. */
const RESULT: RunResult = {
  rules: [
    {
      ruleId: "max-file-size",
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
          ruleId: "max-file-size",
          severity: "error",
          docs: [
            {
              path: "rules/max-file-size.md",
              absolutePath: "/x/max-file-size.md",
            },
          ],
          snippet: "> 401 | x",
        },
      ],
    },
  ],
  errors: 1,
  warnings: 0,
  durationMs: 20,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("jsonReporter", () => {
  it("prints one JSON document when the run finishes", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    const report = jsonReporter();
    report({ kind: "run:start", rules: 1 });
    expect(written).toHaveLength(0);

    report({ kind: "run:done", result: RESULT });
    const parsed = JSON.parse(written.join(""));
    expect(parsed.ok).toBe(false);
    expect(parsed.errors).toBe(1);
    expect(parsed.rules[0].ruleId).toBe("max-file-size");

    const diagnostic = parsed.rules[0].diagnostics[0];
    expect(diagnostic.fix).toBe("split it");
    expect(diagnostic.docs[0].absolutePath).toBe("/x/max-file-size.md");
    expect(diagnostic.snippet).toContain("401");
  });

  it("reports ok on a clean run", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    jsonReporter()({
      kind: "run:done",
      result: { rules: [], errors: 0, warnings: 0, durationMs: 5 },
    });
    expect(JSON.parse(written.join("")).ok).toBe(true);
  });
});
