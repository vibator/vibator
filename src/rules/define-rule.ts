/**
 * The rule definition surface.
 *
 * @packageDocumentation
 */
import type { ZodType } from "zod";
import type { Report } from "./report.ts";
import type { Severity } from "./severity.ts";

/**
 * The shape of a rule. `id`, `title`, and `docs` are required; the rest carry
 * defaults.
 *
 * @typeParam Options - The type inferred from the `options` schema. A rule that
 * declares no schema receives an empty options object.
 */
export interface Rule<Options = unknown> {
  /** The stable kebab-case identifier, used as the config key. */
  id: string;
  /** One line describing what the rule enforces. */
  title: string;
  /**
   * The path to the guideline. It resolves from the project root, such as
   * `.vibator/docs/my-rule.md`, or from a package when prefixed with the package
   * name, such as `vibator:docs/rules/no-deprecated-apis.md`.
   */
  docs: string;
  /** The default severity. The framework applies `"error"` by default. */
  severity?: Severity;
  /** The schema that validates and defaults the rule's config block. */
  options?: ZodType<Options>;
  /**
   * Runs the rule across the files it chooses and returns a report.
   *
   * @param options - The validated options.
   * @returns The report of findings.
   */
  check(options: Options): Report | Promise<Report>;
  /**
   * Corrects the findings in a report. The framework calls it under `--write`.
   *
   * @param options - The validated options.
   * @param report - The report `check` produced.
   */
  fix?(options: Options, report: Report): void | Promise<void>;
}

/** A rule with its options type erased, as the registry stores them. */
export type AnyRule = Rule<unknown>;

/** The registered rules, keyed by id. */
const registry = new Map<string, AnyRule>();

/**
 * Declares and registers a rule, inferring its options type from the schema.
 *
 * @param rule - The rule definition.
 * @returns The same rule, typed.
 * @throws When a rule with the same id is already registered.
 */
export function defineRule<Options>(rule: Rule<Options>): Rule<Options> {
  if (registry.has(rule.id)) {
    throw new Error(`Duplicate rule id: ${rule.id}`);
  }
  registry.set(rule.id, rule as unknown as AnyRule);
  return rule;
}

/**
 * Returns every registered rule.
 *
 * @returns The registered rules.
 */
export function definedRules(): AnyRule[] {
  return [...registry.values()];
}

/**
 * Clears the registry, for a fresh run or test.
 */
export function resetRules(): void {
  registry.clear();
}
