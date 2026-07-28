/**
 * The sarif reporter: the SARIF 2.1.0 interchange format.
 *
 * @packageDocumentation
 */
import type { Log, Region, Result } from "sarif";
import type { Finding } from "../../engine/finding.ts";
import type { Reporter } from "./reporter.ts";

/**
 * The SARIF region of a finding, from its line and column.
 *
 * @param finding - The finding to locate.
 * @returns The SARIF region.
 */
function regionOf(finding: Finding): Region {
  const region: Region = {};
  if (finding.line !== undefined) region.startLine = finding.line;
  if (finding.column !== undefined) region.startColumn = finding.column;
  return region;
}

/**
 * The SARIF result of a finding.
 *
 * @param finding - The finding to render.
 * @returns The SARIF result.
 */
function resultOf(finding: Finding): Result {
  return {
    ruleId: finding.ruleId,
    level: finding.severity === "error" ? "error" : "warning",
    message: { text: finding.message },
    ...(finding.file
      ? {
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: finding.file },
                region: regionOf(finding),
              },
            },
          ],
        }
      : {}),
  };
}

/**
 * The SARIF interchange format, for tools such as trunk.io and code scanning.
 *
 * @param findings - The findings of the run.
 * @returns The rendered SARIF.
 */
export const sarif: Reporter = (findings) => {
  const ruleIds = [...new Set(findings.map((finding) => finding.ruleId))];
  const log: Log = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: { name: "vibator", rules: ruleIds.map((id) => ({ id })) },
        },
        results: findings.map(resultOf),
      },
    ],
  };
  return JSON.stringify(log, null, 2);
};
