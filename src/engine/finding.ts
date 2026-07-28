/**
 * A resolved finding: a diagnostic with its rule and severity.
 *
 * @packageDocumentation
 */
import type { Diagnostic } from "../rules/index.ts";

/**
 * One diagnostic with the rule and severity the framework resolved for it.
 */
export interface Finding extends Diagnostic {
  /** The id of the rule that produced the finding. */
  ruleId: string;
  /** The resolved severity of the finding. */
  severity: "error" | "warn";
}
