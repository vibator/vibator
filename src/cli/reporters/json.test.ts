import { describe, expect, it } from "vitest";
import type { Finding } from "../../engine/finding.ts";
import { json } from "./json.ts";

const findings: Finding[] = [
  {
    ruleId: "no-deprecated-apis",
    severity: "error",
    file: "src/a.ts",
    line: 3,
    column: 5,
    message: "foo is deprecated",
    expected: "Use bar",
    fix: "Replace foo with bar",
  },
  { ruleId: "locale-parity", severity: "warn", message: "keys missing" },
];

describe("json", () => {
  it("emits the findings as JSON", () => {
    expect(JSON.parse(json(findings))).toEqual({ findings });
  });
});
