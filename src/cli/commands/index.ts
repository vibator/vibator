/**
 * The informational and setup subcommands.
 *
 * @packageDocumentation
 */
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Config, load } from "../../configuration/index.ts";
import { loadRules } from "../../engine/load-rules.ts";
import { setRoot } from "../../namespace/runtime.ts";
import type { AnyRule } from "../../rules/define-rule.ts";
import type { Severity } from "../../rules/index.ts";

/**
 * Loads the rules and configuration for an informational command.
 *
 * @param root - The absolute project root.
 * @returns The registered rules and the loaded configuration.
 */
async function loadedRules(
  root: string,
): Promise<{ rules: AnyRule[]; config: Config }> {
  setRoot(root);
  const config = load();
  return { rules: await loadRules(config), config };
}

/**
 * The severity a rule runs at, after configuration.
 *
 * @param rule - The rule.
 * @param config - The loaded configuration.
 * @returns The resolved severity.
 */
function severityOf(rule: AnyRule, config: Config): Severity {
  const entry = config.rules?.[rule.id];
  const override = typeof entry === "string" ? entry : entry?.severity;
  return override ?? rule.severity ?? "error";
}

/**
 * Prints every rule with its severity and title.
 *
 * @param root - The absolute project root. Defaults to the working directory.
 * @returns The listing, one rule per line.
 */
export async function list(root: string = process.cwd()): Promise<string> {
  const { rules, config } = await loadedRules(root);
  return rules
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(
      (rule) =>
        `${severityOf(rule, config).padEnd(5)} ${rule.id}  ${rule.title}`,
    )
    .join("\n");
}

/**
 * Resolves a rule's docs path against the root, or a package when prefixed.
 *
 * @param docs - The docs value from the rule.
 * @param root - The absolute project root.
 * @returns The absolute path of the guideline.
 */
function resolveDocs(docs: string, root: string): string {
  const packaged = docs.match(/^([^:/\\]+):(.+)$/);
  if (packaged) {
    const packagePath = createRequire(import.meta.url).resolve(
      `${packaged[1]}/package.json`,
    );
    return join(dirname(packagePath), packaged[2] ?? "");
  }
  return resolve(root, docs);
}

/**
 * Prints the guideline for a rule.
 *
 * @param rule - The rule id.
 * @param root - The absolute project root. Defaults to the working directory.
 * @returns The guideline content.
 * @throws When no rule has the id.
 */
export async function explain(
  rule: string,
  root: string = process.cwd(),
): Promise<string> {
  const { rules } = await loadedRules(root);
  const found = rules.find((candidate) => candidate.id === rule);
  if (!found) {
    throw new Error(`No such rule: ${rule}`);
  }
  return readFileSync(resolveDocs(found.docs, root), "utf8");
}

/** The starter configuration `init` writes. */
const STARTER: Config = {
  $schema: "./node_modules/vibator/schema.json",
  rules: {},
};

/**
 * Writes a starter `.vibator.json`.
 *
 * @param root - The absolute project root. Defaults to the working directory.
 * @returns A confirmation message.
 * @throws When a `.vibator.json` already exists.
 */
export function init(root: string = process.cwd()): string {
  const path = join(root, ".vibator.json");
  if (existsSync(path)) {
    throw new Error(`${path} already exists`);
  }
  writeFileSync(path, `${JSON.stringify(STARTER, null, 2)}\n`);
  return `Wrote ${path}`;
}

/**
 * Copies the bundled skills into the project.
 *
 * @param install - Whether to install the skills, from the `--install` flag.
 * @param root - The absolute project root. Defaults to the working directory.
 * @returns A confirmation or usage message.
 */
export function skills(install: boolean, root: string = process.cwd()): string {
  const source = fileURLToPath(new URL("../../../skills", import.meta.url));
  if (!install) {
    return "Run `vibator skills --install` to copy the bundled skills into .claude/skills.";
  }
  if (!existsSync(source)) {
    return "No bundled skills to install.";
  }
  const target = join(root, ".claude", "skills");
  cpSync(source, target, { recursive: true });
  return `Installed skills into ${target}`;
}
