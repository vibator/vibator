/**
 * Test helpers for rule authors, exported as `vibator/testing`.
 *
 * @packageDocumentation
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Finding } from "../engine/finding.ts";
import { run } from "../engine/run.ts";
import type { Rule } from "../rules/define-rule.ts";

/**
 * The project a rule runs against in a test.
 */
export interface RuleFixture {
  /** The files of the project, keyed by root-relative path. */
  files?: Record<string, string>;
  /** The options passed to the rule, as `.vibator.json` would pass them. */
  options?: object;
}

/**
 * Writes the fixture files and the rule's options into a project folder.
 *
 * @param dir - The absolute project folder.
 * @param ruleId - The id of the rule the options belong to.
 * @param fixture - The files and options.
 */
function writeFixture(dir: string, ruleId: string, fixture: RuleFixture): void {
  for (const [path, content] of Object.entries(fixture.files ?? {})) {
    const absolute = join(dir, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
  }
  if (fixture.options) {
    const config = { rules: { [ruleId]: { options: fixture.options } } };
    writeFileSync(join(dir, ".vibator.json"), JSON.stringify(config));
  }
}

/**
 * Runs one rule against a temporary project and returns its findings. The
 * findings carry root-relative paths and no snippet or guideline, so a test
 * can compare them whole.
 *
 * @param rule - The rule to run. It must be defined with `defineRule`.
 * @param fixture - The project files and the rule options.
 * @returns The findings the rule produced.
 */
export async function runRule<Options>(
  rule: Rule<Options>,
  fixture: RuleFixture = {},
): Promise<Finding[]> {
  const dir = mkdtempSync(join(tmpdir(), "vibator-rule-"));
  try {
    writeFixture(dir, rule.id, fixture);
    const { findings } = await run({ root: dir, only: [rule.id] });
    return findings.map(({ snippet, docs, ...finding }) => finding);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
