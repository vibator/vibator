import type { Log } from "sarif";
import { describe, expect, it } from "vitest";
import type { Finding } from "../../engine/finding.ts";
import { sarif } from "./sarif.ts";

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

// The SARIF structure is enforced against the 2.1.0 type definitions by typing
// the parsed output as `Log`; these tests verify the mapping decisions.
const log = JSON.parse(sarif(findings)) as Log;

describe("sarif", () => {
  it("declares SARIF 2.1.0", () => {
    expect(log.version).toBe("2.1.0");
    expect(log.$schema).toContain("sarif-2.1.0");
  });

  it("names vibator as the tool and lists each rule once", () => {
    const driver = log.runs[0]?.tool.driver;
    expect(driver?.name).toBe("vibator");
    expect(driver?.rules?.map((rule) => rule.id).sort()).toEqual([
      "locale-parity",
      "no-deprecated-apis",
    ]);
  });

  it("maps severity to the SARIF level", () => {
    const byRule = Object.fromEntries(
      (log.runs[0]?.results ?? []).map((result) => [result.ruleId, result]),
    );
    expect(byRule["no-deprecated-apis"]?.level).toBe("error");
    expect(byRule["locale-parity"]?.level).toBe("warning");
  });

  it("places a finding's location", () => {
    const result = log.runs[0]?.results?.find(
      (entry) => entry.ruleId === "no-deprecated-apis",
    );
    const location = result?.locations?.[0]?.physicalLocation;
    expect(location?.artifactLocation?.uri).toBe("src/a.ts");
    expect(location?.region).toEqual({ startLine: 3, startColumn: 5 });
  });

  it("omits the location for a project-level finding", () => {
    const result = log.runs[0]?.results?.find(
      (entry) => entry.ruleId === "locale-parity",
    );
    expect(result?.locations).toBeUndefined();
  });
});
