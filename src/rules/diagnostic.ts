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
  /** The start line, or the single line where the finding is. */
  line?: number;
  /** The last line, when the finding spans several. */
  endLine?: number;
  /** The column where the finding starts. */
  column?: number;
  /** What the finding reports as wrong. */
  message: string;
  /** The standard the rule requires. */
  expected?: string;
  /** The concrete next action that resolves it. */
  fix?: string;
}
