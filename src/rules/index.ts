/**
 * The rule definition surface: the function that declares a rule, the shape of
 * a rule, and the types a rule returns.
 *
 * @packageDocumentation
 */
export { defineRule, type Rule } from "./define-rule.ts";
export type { Diagnostic } from "./diagnostic.ts";
export type { Report } from "./report.ts";
export { scope } from "./scope.ts";
export type { Severity } from "./severity.ts";
