/**
 * Machine-facing reporter.
 *
 * @remarks This is the surface an agent consumes. Every finding keeps its
 * `expected` and `fix` fields and a pointer to the guideline, so a tool acting
 * on the output never has to parse intent out of prose.
 *
 * @packageDocumentation
 */
import type { RunEvent } from "../core/engine.ts";

/**
 * Creates the JSON reporter.
 *
 * @returns An event sink that prints one JSON document when the run finishes.
 */
export function jsonReporter(): (event: RunEvent) => void {
  return (event) => {
    if (event.kind !== "run:done") return;

    const { result } = event;
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: result.errors === 0,
          errors: result.errors,
          warnings: result.warnings,
          durationMs: result.durationMs,
          rules: result.rules.map((rule) => ({
            ruleId: rule.ruleId,
            title: rule.title,
            files: rule.files,
            durationMs: rule.durationMs,
            error: rule.error,
            diagnostics: rule.diagnostics,
          })),
        },
        null,
        2,
      )}\n`,
    );
  };
}
