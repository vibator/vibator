/**
 * The engine run: set the root and scope, load rules, check, fix under
 * `--write`, and collect findings.
 *
 * @packageDocumentation
 */
import { relative } from "node:path";
import { type Config, load } from "../configuration/index.ts";
import { git } from "../namespace/git/index.ts";
import { File } from "../namespace/project/index.ts";
import {
  setExcludedDirectories,
  setRoot,
  setScope,
} from "../namespace/runtime.ts";
import type { AnyRule } from "../rules/define-rule.ts";
import type { Diagnostic } from "../rules/index.ts";
import { resolveDocs } from "./docs.ts";
import type { Finding } from "./finding.ts";
import { loadRules } from "./load-rules.ts";
import { snippetAround } from "./snippet.ts";

/**
 * The inputs a run needs.
 */
export interface RunInput {
  /** The absolute project root. Defaults to the current working directory. */
  root?: string;
  /** The configuration path. Defaults to `.vibator.json` at the root. */
  config?: string;
  /** The rule ids to run. Runs every rule when omitted. */
  only?: string[];
  /** Whether to apply each rule's fix and recheck. */
  write?: boolean;
  /** Scope the run to files staged for commit. */
  staged?: boolean;
  /** Scope the run to uncommitted changes. */
  changed?: boolean;
  /** Scope the run to changes since a ref. */
  since?: string;
}

/**
 * The outcome of a run.
 */
export interface RunResult {
  /** Every finding the run produced. */
  findings: Finding[];
  /** The process exit code. */
  exitCode: number;
}

/** A rule's resolved severity, options, and guideline path. */
interface Resolved {
  severity: "error" | "warn";
  options: unknown;
  docs: string;
}

/**
 * The repo-relative files a run's scope flags select, from git.
 *
 * @param input - The run inputs.
 * @returns The scoped paths, or undefined when no scope flag is set.
 */
function scopeFor(input: RunInput): string[] | undefined {
  if (input.staged) return git.stagedFiles();
  if (input.since) {
    return [
      ...new Set([...git.changedFiles(), ...git.changedSince(input.since)]),
    ];
  }
  if (input.changed) return git.changedFiles();
  return undefined;
}

/**
 * Resolves a rule's severity and options from the configuration.
 *
 * @param rule - The rule to resolve.
 * @param config - The loaded configuration.
 * @returns The resolved severity and options, or undefined when the rule is off.
 */
function resolveRule(rule: AnyRule, config: Config): Resolved | undefined {
  const entry = config.rules?.[rule.id];
  const override = typeof entry === "string" ? entry : entry?.severity;
  const severity = override ?? rule.severity ?? "error";
  if (severity === "off") return undefined;
  const raw = (typeof entry === "object" ? entry.options : undefined) ?? {};
  const options = rule.options ? rule.options.parse(raw) : raw;
  const docs =
    (typeof entry === "object" ? entry.docs : undefined) ?? rule.docs;
  return { severity, options, docs };
}

/**
 * Turns a diagnostic into a finding, relativizing its file against the root.
 *
 * @param ruleId - The id of the rule that produced the diagnostic.
 * @param severity - The resolved severity.
 * @param diagnostic - The diagnostic to convert.
 * @param root - The absolute project root.
 * @param docs - The absolute path of the rule's guideline.
 * @returns The finding.
 */
function toFinding(
  ruleId: string,
  severity: "error" | "warn",
  diagnostic: Diagnostic,
  root: string,
  docs: string,
): Finding {
  return {
    ...diagnostic,
    file: diagnostic.file
      ? relative(root, diagnostic.file).replaceAll("\\", "/")
      : undefined,
    snippet: snippetFor(diagnostic.file, diagnostic.line, diagnostic.endLine),
    ruleId,
    severity,
    docs,
  };
}

/**
 * Renders the source excerpt around a finding that points at a line in a
 * readable file.
 *
 * @param file - The absolute path of the finding.
 * @param line - The start line of the finding.
 * @param endLine - The last line, when the finding spans several.
 * @returns The excerpt, or undefined when there is no line or the read fails.
 */
function snippetFor(
  file: string | undefined,
  line: number | undefined,
  endLine: number | undefined,
): string | undefined {
  if (!file || line === undefined) return undefined;
  try {
    return snippetAround(new File(file).content, line, endLine);
  } catch {
    return undefined;
  }
}

/**
 * Runs one rule and collects its findings, applying its fix and rechecking
 * under `write`.
 *
 * @param rule - The rule to run.
 * @param resolved - Its resolved severity and options.
 * @param root - The absolute project root.
 * @param write - Whether to apply the rule's fix and recheck.
 * @returns The findings the rule produced.
 */
async function runRule(
  rule: AnyRule,
  resolved: Resolved,
  root: string,
  write: boolean,
): Promise<Finding[]> {
  let report = await rule.check(resolved.options);
  if (write && rule.fix) {
    await rule.fix(resolved.options, report);
    report = await rule.check(resolved.options);
  }
  const guideline = resolveDocs(resolved.docs, root);
  return report.diagnostics.map((diagnostic) =>
    toFinding(rule.id, resolved.severity, diagnostic, root, guideline),
  );
}

/**
 * Runs one rule, returning its findings or a crash finding.
 *
 * @param rule - The rule to run.
 * @param config - The loaded configuration.
 * @param root - The absolute project root.
 * @param write - Whether to apply the rule's fix and recheck.
 * @returns The findings the rule produced.
 */
async function findingsFor(
  rule: AnyRule,
  config: Config,
  root: string,
  write: boolean,
): Promise<Finding[]> {
  try {
    const resolved = resolveRule(rule, config);
    if (!resolved) return [];
    return await runRule(rule, resolved, root, write);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [
      {
        ruleId: rule.id,
        severity: "error",
        message: `Rule crashed: ${message}`,
      },
    ];
  }
}

/**
 * Runs every enabled rule, applies fixes under `write`, and collects findings.
 *
 * @remarks Sets the project root and scope on the namespace runtime, so the
 * rules read their files from them.
 * @param input - The run inputs.
 * @returns The findings and the process exit code.
 */
export async function run(input: RunInput): Promise<RunResult> {
  const root = input.root ?? process.cwd();
  setRoot(root);
  setScope(scopeFor(input));
  const config = load(input.config);
  if (config.exclude) setExcludedDirectories(config.exclude);
  const rules = await loadRules(config);

  const findings: Finding[] = [];
  for (const rule of rules) {
    if (input.only && !input.only.includes(rule.id)) continue;
    findings.push(
      ...(await findingsFor(rule, config, root, input.write ?? false)),
    );
  }

  const exitCode = findings.some((finding) => finding.severity === "error")
    ? 1
    : 0;
  return { findings, exitCode };
}
