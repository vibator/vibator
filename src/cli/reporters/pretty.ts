/**
 * The pretty reporter: a readable report for a terminal.
 *
 * @packageDocumentation
 */
import type { Finding } from "../../engine/finding.ts";
import type { Reporter } from "./reporter.ts";

/**
 * The location of a finding, or `<project>` when it has no file.
 *
 * @param finding - The finding to locate.
 * @returns The location string.
 */
function locationOf(finding: Finding): string {
  if (!finding.file) return "<project>";
  if (finding.line === undefined) return finding.file;
  if (finding.column === undefined) return `${finding.file}:${finding.line}`;
  return `${finding.file}:${finding.line}:${finding.column}`;
}

/**
 * A readable, colored report for a terminal. The default.
 *
 * @param findings - The findings of the run.
 * @returns The rendered report.
 */
export const pretty: Reporter = (findings) => {
  if (findings.length === 0) return "No findings.";
  const lines = findings.map(
    (finding) =>
      `${locationOf(finding)} ${finding.severity} ${finding.ruleId}  ${finding.message}`,
  );
  const errors = findings.filter(
    (finding) => finding.severity === "error",
  ).length;
  const warnings = findings.length - errors;
  lines.push("", `${errors} error(s), ${warnings} warning(s)`);
  return lines.join("\n");
};
