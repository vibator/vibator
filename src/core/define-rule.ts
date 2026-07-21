/**
 * The helper plugin authors write rules with.
 *
 * @packageDocumentation
 */
import type { Rule } from "./rule.ts";

/**
 * Declares a rule, inferring its options type from its schema.
 *
 * @remarks Identity at runtime; it exists for the type inference. Writing the
 * object literal directly works too, but then the `options` passed to `check`
 * is only as good as the annotation the author remembered to add.
 * @param rule - The rule definition.
 * @returns The same rule, typed.
 */
export function defineRule<Options>(rule: Rule<Options>): Rule<Options> {
  return rule;
}
