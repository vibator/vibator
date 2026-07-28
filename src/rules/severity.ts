/**
 * The severity of a rule and its findings.
 *
 * @packageDocumentation
 */

/**
 * The importance the framework assigns a finding.
 *
 * @remarks `"error"` fails the run, `"warn"` reports the finding and keeps the
 * run passing, and `"off"` skips the rule.
 */
export type Severity = "error" | "warn" | "off";
