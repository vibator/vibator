/**
 * The informational subcommands: `list`, `explain`, `docs` and `skills`.
 *
 * @packageDocumentation
 */
import { cpSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { type Config, resolveRules } from "../core/config.ts";
import { packageRoot } from "../core/package-root.ts";
import type { AnyRule } from "../core/rule.ts";

/**
 * The documents `vibator docs` can print, by topic name.
 *
 * @remarks This exists so nothing outside this package needs to know where it
 * is installed — `node_modules/vibator/docs/...` is only one package manager's
 * answer, and Yarn PnP has no such path at all.
 */
const DOC_TOPICS: Record<string, string> = {
  "writing-rules": "docs/writing-rules.md",
  configuration: "docs/configuration.md",
  rules: "docs/rule-catalog.md",
};

/**
 * Prints a bundled document.
 *
 * @param topic - The document to print; lists the topics when omitted.
 * @returns Nothing; exits non-zero when the topic is unknown.
 */
export function docs(topic: string | undefined): void {
  const path = topic ? DOC_TOPICS[topic] : undefined;
  if (!path) {
    const known = Object.keys(DOC_TOPICS).join(", ");
    if (topic) {
      console.error(`Unknown topic: ${topic}\nTopics: ${known}`);
      process.exitCode = 1;
      return;
    }
    console.log(`Topics: ${known}\n\nPrint one with: vibator docs <topic>`);
    return;
  }
  console.log(readFileSync(join(packageRoot, path), "utf8"));
}

/**
 * Prints a rule's guideline document.
 *
 * @remarks A project override wins over the guideline shipped with the rule, so
 * `explain` always prints the standard actually in force. Supplementary project
 * documents mapped through `guidelines` are listed after it.
 * @param ruleId - The rule to explain.
 * @param rules - Every registered rule, built-in and plugin.
 * @param root - Absolute project root.
 * @param config - The loaded config.
 * @returns Nothing; exits non-zero when the rule is unknown.
 */
export function explain(
  ruleId: string | undefined,
  rules: AnyRule[],
  root: string,
  config: Config,
): void {
  const rule = rules.find((entry) => entry.id === ruleId);
  if (!rule) {
    console.error(`Unknown rule: ${ruleId ?? "(none given)"}`);
    console.error(`Known rules: ${rules.map((entry) => entry.id).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  // Resolved against the full set: passing one rule would make every other
  // config key look like it names an unknown rule.
  const resolved = resolveRules(config, rules).find(
    (entry) => entry.rule.id === rule.id,
  );
  const path = resolved?.docsOverridden
    ? resolve(root, resolved.docs)
    : join(packageRoot, "docs", rule.docs);

  printGuideline(rule, path, resolved?.guidelines ?? []);
}

/**
 * Prints a guideline file, or a stand-in when none is present.
 *
 * @param rule - The rule being explained.
 * @param path - Absolute path of the guideline to print.
 * @param supplementary - Project documents mapped onto the rule.
 */
function printGuideline(
  rule: AnyRule,
  path: string,
  supplementary: string[],
): void {
  try {
    console.log(readFileSync(path, "utf8"));
  } catch {
    console.log(`# ${rule.id}

${rule.title}

(No guideline found at ${path}.)`);
  }
  if (supplementary.length > 0) {
    console.log(`
Project guidelines: ${supplementary.join(", ")}`);
  }
}

/**
 * Lists every registered rule.
 *
 * @param rules - Every rule, built-in and plugin.
 * @returns Nothing; prints one line per rule.
 */
export function list(rules: AnyRule[]): void {
  rules.forEach((rule) => {
    console.log(
      `${rule.id.padEnd(24)} ${rule.defaultSeverity.padEnd(6)} ${rule.title}`,
    );
  });
}

/**
 * Reports or installs the agent skills bundled with this package.
 *
 * @remarks A published package cannot put files into a consumer's project, so
 * the skills ship inside it and this copies them on request. Copying rather
 * than symlinking survives `node_modules` being reinstalled.
 * @param root - Absolute project root.
 * @param install - Whether to copy into `.claude/skills/`.
 * @returns Nothing; prints what it found or wrote.
 */
export function skills(root: string, install: boolean): void {
  const source = join(packageRoot, "skills");
  if (!existsSync(source)) {
    console.error("This build ships no skills.");
    process.exitCode = 1;
    return;
  }

  const available = readdirSync(source);
  if (!install) {
    console.log(`Bundled skills (${source}):\n`);
    available.forEach((name) => {
      console.log(`  ${name}`);
    });
    console.log(
      "\nInstall into .claude/skills/ with: vibator skills --install",
    );
    return;
  }

  const target = resolve(root, ".claude", "skills");
  available.forEach((name) => {
    cpSync(join(source, name), join(target, name), { recursive: true });
    console.log(`Installed ${name} -> .claude/skills/${name}`);
  });
}
