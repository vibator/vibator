/**
 * One finding a rule reports.
 *
 * @packageDocumentation
 */

/**
 * One finding in a report.
 */
export interface Diagnostic {
  /**
   * The absolute path of the finding; reporters display it relative to the
   * project root. Omit it for a whole-project finding.
   */
  file?: string;
  /** The 1-based line. */
  line?: number;
  /** The 1-based column. */
  column?: number;
  /** What the finding reports as wrong. */
  message: string;
  /** The standard the rule requires. */
  expected?: string;
  /** The concrete next action that resolves it. */
  fix?: string;
}
