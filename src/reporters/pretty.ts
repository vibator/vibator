/**
 * Human-facing reporter: live progress while running, grouped findings after.
 *
 * @packageDocumentation
 */
import { styleText } from "node:util";
import { locationOf, type ReportedDiagnostic } from "../core/diagnostic.ts";
import type { RuleResult, RunEvent } from "../core/engine.ts";

/** Width the rule name column is padded to, so the bars line up. */
const NAME_WIDTH = 22;

/** Cells in a progress bar. */
const BAR_WIDTH = 12;

/** Whether to emit colour and in-place updates at all. */
const interactive = Boolean(process.stderr.isTTY) && !process.env.NO_COLOR;

/**
 * Colours text, or returns it untouched where colour is unwanted.
 *
 * @param style - One or more `util.styleText` styles.
 * @param text - The text to colour.
 * @returns The styled text.
 */
function paint(style: Parameters<typeof styleText>[0], text: string): string {
  return interactive ? styleText(style, text) : text;
}

/**
 * Renders a progress bar.
 *
 * @param done - Units completed.
 * @param total - Units in total.
 * @returns The bar, filled proportionally.
 */
function progressBar(done: number, total: number): string {
  const filled =
    total === 0 ? BAR_WIDTH : Math.round((done / total) * BAR_WIDTH);
  return "█".repeat(filled) + "░".repeat(Math.max(0, BAR_WIDTH - filled));
}

/**
 * Rewrites the current terminal line.
 *
 * @param text - What to display.
 */
function replaceLine(text: string): void {
  if (!interactive) return;
  process.stderr.write(`\r[2K${text}`);
}

/**
 * The icon and colour summarising a finished rule.
 *
 * @param result - The rule's result.
 * @returns A coloured status glyph.
 */
function statusOf(result: RuleResult): string {
  if (result.error) return paint("magenta", "!");
  const errors = result.diagnostics.filter(
    (entry) => entry.severity === "error",
  ).length;
  if (errors > 0) return paint("red", "✖");
  if (result.diagnostics.length > 0) return paint("yellow", "▲");
  return paint("green", "✔");
}

/**
 * The trailing summary for a finished rule.
 *
 * @param result - The rule's result.
 * @returns A coloured count, or the empty string when the rule was clean.
 */
function tallyOf(result: RuleResult): string {
  if (result.error) return paint("magenta", "rule failed");
  const errors = result.diagnostics.filter(
    (entry) => entry.severity === "error",
  ).length;
  const warnings = result.diagnostics.length - errors;
  const parts = [
    errors > 0 ? paint("red", `${errors} error${errors === 1 ? "" : "s"}`) : "",
    warnings > 0
      ? paint("yellow", `${warnings} warning${warnings === 1 ? "" : "s"}`)
      : "",
  ].filter(Boolean);
  return parts.join(" ");
}

/**
 * Renders one finding as an indented block.
 *
 * @param diagnostic - The finding.
 * @returns The lines to print.
 */
function renderDiagnostic(diagnostic: ReportedDiagnostic): string[] {
  const marker =
    diagnostic.severity === "error"
      ? paint("red", "error")
      : paint("yellow", "warn");
  const lines = [`  ${marker}  ${paint("bold", locationOf(diagnostic))}`];
  lines.push(`         ${diagnostic.message}`);
  if (diagnostic.snippet) {
    lines.push(
      ...diagnostic.snippet
        .split("\n")
        .map((row) => `         ${paint("dim", row)}`),
    );
  }
  if (diagnostic.expected) {
    lines.push(`         ${paint("dim", `expected: ${diagnostic.expected}`)}`);
  }
  if (diagnostic.fix) {
    lines.push(`         ${paint("cyan", `fix: ${diagnostic.fix}`)}`);
  }
  return lines;
}

/**
 * Prints the findings of every rule that had any.
 *
 * @param rules - Per-rule results.
 */
function printFindings(rules: RuleResult[]): void {
  rules
    .filter((result) => result.diagnostics.length > 0 || result.error)
    .forEach((result) => {
      process.stdout.write(
        `\n${paint("bold", result.ruleId)} ${paint("dim", `— ${result.title}`)}\n`,
      );
      if (result.error) {
        process.stdout.write(
          `  ${paint("magenta", "rule failed:")} ${result.error}\n`,
        );
        return;
      }
      result.diagnostics.forEach((diagnostic) => {
        process.stdout.write(`${renderDiagnostic(diagnostic).join("\n")}\n`);
      });
      const docs = result.diagnostics[0]?.docs ?? [];
      if (docs.length > 0) {
        const shown = docs.map((entry) => entry.path).join(", ");
        process.stdout.write(`  ${paint("dim", `→ ${shown}`)}\n`);
      }
    });
}

/**
 * Renders the in-place progress line for a rule still running.
 *
 * @param ruleId - The rule being run, already padded.
 * @param event - The event driving the update.
 */
function renderProgress(ruleId: string, event: RunEvent): void {
  if (event.kind === "rule:start") {
    replaceLine(
      `  ${paint("dim", "…")} ${ruleId} ${paint("dim", "discovering…")}`,
    );
  }
  if (event.kind === "rule:discovered") {
    replaceLine(
      `  ${paint("dim", "…")} ${ruleId} ${paint("dim", `${event.files} files`)}`,
    );
  }
  if (event.kind === "rule:progress") {
    replaceLine(
      `  ${paint("dim", "…")} ${ruleId} ${progressBar(event.done, event.total)} ` +
        paint("dim", `${event.done}/${event.total}`),
    );
  }
}

/**
 * Prints the settled one-line summary for a finished rule.
 *
 * @param result - The rule's result.
 */
function renderRuleSummary(result: RuleResult): void {
  replaceLine("");
  process.stderr.write(
    `  ${statusOf(result)} ${result.ruleId.padEnd(NAME_WIDTH)} ` +
      `${paint("dim", `${String(result.files).padStart(4)} files`)} ` +
      `${paint("dim", `${String(result.durationMs).padStart(5)}ms`)}  ` +
      `${tallyOf(result)}
`,
  );
}

/**
 * Creates the pretty reporter.
 *
 * @returns An event sink to hand to the engine.
 */
export function prettyReporter(): (event: RunEvent) => void {
  let current = "";

  return (event) => {
    if (event.kind === "run:start") {
      process.stderr.write(
        `
${paint("bold", "vibator")} ${paint("dim", `${event.rules} rules`)}

`,
      );
      return;
    }
    if (event.kind === "rule:start") current = event.ruleId.padEnd(NAME_WIDTH);
    if (event.kind === "rule:done") {
      renderRuleSummary(event.result);
      return;
    }
    if (event.kind === "run:done") {
      printFindings(event.result.rules);
      printSummary(
        event.result.errors,
        event.result.warnings,
        event.result.durationMs,
      );
      return;
    }
    renderProgress(current, event);
  };
}

/**
 * Prints the closing summary line.
 *
 * @param errors - Total error-severity findings.
 * @param warnings - Total warning-severity findings.
 * @param durationMs - Wall-clock time for the run.
 */
function printSummary(
  errors: number,
  warnings: number,
  durationMs: number,
): void {
  const verdict =
    errors > 0
      ? paint(["red", "bold"], `${errors} error${errors === 1 ? "" : "s"}`)
      : paint(["green", "bold"], "no errors");
  const warned =
    warnings > 0
      ? paint("yellow", `, ${warnings} warning${warnings === 1 ? "" : "s"}`)
      : "";
  process.stdout.write(
    `\n${verdict}${warned} ${paint("dim", `in ${durationMs}ms`)}\n`,
  );
}
