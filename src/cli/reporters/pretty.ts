/**
 * The pretty reporter: a readable report for a terminal.
 *
 * @packageDocumentation
 */
import { styleText } from "node:util";
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
 * Paints a snippet: the marked lines keep the terminal's own color, the
 * context lines around them are dimmed.
 *
 * @param snippet - The rendered excerpt.
 * @returns The painted excerpt.
 */
function paintSnippet(snippet: string): string {
  return snippet
    .split("\n")
    .map((line) => (line.startsWith(">") ? line : styleText("dim", line)))
    .join("\n");
}

/**
 * Renders one finding as a location header with its snippet and guideline.
 *
 * @param finding - The finding to render.
 * @returns The rendered block.
 */
function block(finding: Finding): string {
  const severity = styleText(
    finding.severity === "error" ? "red" : "yellow",
    finding.severity,
  );
  const parts = [
    `${styleText("cyan", locationOf(finding))} ${severity} ${styleText("dim", finding.ruleId)}  ${finding.message}`,
  ];
  if (finding.snippet) parts.push(paintSnippet(finding.snippet));
  if (finding.docs) parts.push(styleText("dim", `guideline: ${finding.docs}`));
  return parts.join("\n");
}

/**
 * Renders the closing count, painted after the worst severity present.
 *
 * @param errors - The number of error-severity findings.
 * @param warnings - The number of warning-severity findings.
 * @returns The rendered summary.
 */
function summary(errors: number, warnings: number): string {
  const text = `${errors} error(s), ${warnings} warning(s)`;
  if (errors > 0) return styleText("red", text);
  if (warnings > 0) return styleText("yellow", text);
  return styleText("green", text);
}

/**
 * A readable, colored report for a terminal. The default.
 *
 * @param findings - The findings of the run.
 * @returns The rendered report.
 */
export const pretty: Reporter = (findings) => {
  if (findings.length === 0) return styleText("green", "No findings.");
  const blocks = findings.map(block);
  const errors = findings.filter(
    (finding) => finding.severity === "error",
  ).length;
  blocks.push("", summary(errors, findings.length - errors));
  return blocks.join("\n");
};
