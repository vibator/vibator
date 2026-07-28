/**
 * The result a rule returns.
 *
 * @packageDocumentation
 */
import type { Diagnostic } from "./diagnostic.ts";

/**
 * The result of a rule execution. One rule produces one report covering every
 * file it read.
 */
export interface Report {
  /** Every finding from the rule execution. */
  diagnostics: Diagnostic[];
}
