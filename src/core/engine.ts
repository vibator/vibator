/**
 * Run orchestration: discovery, analysis, and the events a reporter draws from.
 *
 * @packageDocumentation
 */

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ResolvedRule } from "./config.ts";
import { createContext, type RuleContext } from "./context.ts";
import type {
  Diagnostic,
  GuidelineReference,
  ReportedDiagnostic,
} from "./diagnostic.ts";
import { discover } from "./discovery.ts";
import { packageRoot } from "./package-root.ts";
import { snippetAround } from "./snippet.ts";

/** What the engine tells a reporter, as it happens. */
export type RunEvent =
  | { kind: "run:start"; rules: number }
  | { kind: "rule:start"; ruleId: string; title: string }
  | { kind: "rule:discovered"; ruleId: string; files: number }
  | { kind: "rule:progress"; ruleId: string; done: number; total: number }
  | { kind: "rule:done"; ruleId: string; result: RuleResult }
  | { kind: "run:done"; result: RunResult };

/** Everything one rule produced. */
export interface RuleResult {
  /** The rule's identifier. */
  ruleId: string;
  /** Its one-line title. */
  title: string;
  /** How many files it judged. */
  files: number;
  /** Wall-clock milliseconds it took. */
  durationMs: number;
  /** Its findings, already carrying severity and docs. */
  diagnostics: ReportedDiagnostic[];
  /** Set when the rule itself failed, rather than finding a violation. */
  error?: string;
}

/** Everything a run produced. */
export interface RunResult {
  /** Per-rule results, in the order they ran. */
  rules: RuleResult[];
  /** Total findings at `error` severity. */
  errors: number;
  /** Total findings at `warn` severity. */
  warnings: number;
  /** Wall-clock milliseconds for the whole run. */
  durationMs: number;
}

/** Where a run sends its events. */
export type EventSink = (event: RunEvent) => void;

/** Knobs a caller can set for one run. */
export interface RunOptions {
  /**
   * When set, only these repo-relative paths are judged.
   *
   * @remarks This is how `--changed` narrows a run to the files a branch
   * touched. Project rules still receive the narrowed list, but ones that
   * consult sources of their own — a generator, a locale tree — judge what
   * they judge; the restriction is a scope, not a sandbox.
   */
  restrict?: ReadonlySet<string>;
}

/**
 * Resolves one guideline path to a document on disk.
 *
 * @remarks A configured override is a project file and resolves against the
 * root alone. A rule's own guideline ships in this package's `docs/`, except
 * for plugin rules, whose documents live in the project — so both places are
 * tried, package first.
 * @param root - Absolute project root.
 * @param path - The guideline path as the rule or config states it.
 * @param overridden - Whether config replaced the rule's own guideline.
 * @returns The reference, with an absolute path when the document exists.
 */
function resolveGuideline(
  root: string,
  path: string,
  overridden: boolean,
): GuidelineReference {
  const candidates = overridden
    ? [resolve(root, path)]
    : [join(packageRoot, "docs", path), resolve(root, path)];
  const found = candidates.find((candidate) => existsSync(candidate));
  return found ? { path, absolutePath: found } : { path };
}

/**
 * The full guideline list a rule's findings point at.
 *
 * @param root - Absolute project root.
 * @param resolved - The rule and its settings.
 * @returns The guideline in force first, then mapped project documents.
 */
function guidelinesOf(
  root: string,
  resolved: ResolvedRule,
): GuidelineReference[] {
  return [
    resolveGuideline(root, resolved.docs, resolved.docsOverridden),
    ...resolved.guidelines.map((path) => resolveGuideline(root, path, true)),
  ];
}

/**
 * The source excerpt for a finding, when it points at a line.
 *
 * @param context - Shared resources, for the memoized read.
 * @param diagnostic - The finding to excerpt.
 * @returns The excerpt, or `undefined` for project-wide or unreadable targets.
 */
function excerptOf(
  context: RuleContext,
  diagnostic: Diagnostic,
): string | undefined {
  if (!diagnostic.file || diagnostic.line === undefined) return undefined;
  try {
    return snippetAround(context.read(diagnostic.file), diagnostic.line);
  } catch {
    // The finding may name a file that does not exist — a missing locale
    // namespace, a missing .env.example. No excerpt is the right answer.
    return undefined;
  }
}

/**
 * Attaches rule identity, severity, guidelines and an excerpt to raw findings.
 *
 * @param root - Absolute project root.
 * @param context - Shared resources.
 * @param resolved - The rule that produced them.
 * @param diagnostics - The raw findings.
 * @returns The findings, ready to report.
 */
function attribute(
  root: string,
  context: RuleContext,
  resolved: ResolvedRule,
  diagnostics: Diagnostic[],
): ReportedDiagnostic[] {
  const docs = guidelinesOf(root, resolved);
  return diagnostics.map((diagnostic) => ({
    ...diagnostic,
    ruleId: resolved.rule.id,
    severity: resolved.severity,
    docs,
    snippet: excerptOf(context, diagnostic),
  }));
}

/**
 * Runs one rule over its discovered files.
 *
 * @param resolved - The rule and its settings.
 * @param files - The files discovery selected.
 * @param context - Shared resources.
 * @returns The rule's raw findings.
 */
async function runRule(
  resolved: ResolvedRule,
  files: string[],
  context: ReturnType<typeof createContext>["context"],
): Promise<Diagnostic[]> {
  const { rule, options } = resolved;

  if (rule.scope === "project") {
    return await rule.check({ files, options, context });
  }

  const found: Diagnostic[] = [];
  files.forEach((file, index) => {
    found.push(
      ...rule.checkFile({
        file,
        bytes: context.readBytes(file),
        options,
        context,
      }),
    );
    context.progress(index + 1, files.length);
  });
  return found;
}

/**
 * Executes every enabled rule and collects the outcome.
 *
 * @remarks Every rule runs, even after one fails. Stopping at the first failure
 * hides the rest of the picture behind whichever gate happens to be ordered
 * first, which is precisely the problem a chain of `&&`-ed scripts has.
 * @param root - Absolute project root.
 * @param rules - The resolved, enabled rules.
 * @param emit - Where to send progress events.
 * @param options - Optional knobs, such as a restricted file set.
 * @returns The run result.
 */
export async function run(
  root: string,
  rules: ResolvedRule[],
  emit: EventSink,
  options: RunOptions = {},
): Promise<RunResult> {
  const startedAt = Date.now();
  const { context, setProgressSink } = createContext(root);
  const results: RuleResult[] = [];

  emit({ kind: "run:start", rules: rules.length });

  for (const resolved of rules) {
    const { rule } = resolved;
    emit({ kind: "rule:start", ruleId: rule.id, title: rule.title });

    const ruleStartedAt = Date.now();
    const discovered = discover(root, resolved.include, resolved.exclude);
    const files = options.restrict
      ? discovered.filter((file) => options.restrict?.has(file))
      : discovered;
    emit({ kind: "rule:discovered", ruleId: rule.id, files: files.length });

    setProgressSink((done, total) => {
      emit({ kind: "rule:progress", ruleId: rule.id, done, total });
    });

    const result = await collect(root, resolved, files, context, ruleStartedAt);
    setProgressSink(() => {});
    results.push(result);
    emit({ kind: "rule:done", ruleId: rule.id, result });
  }

  const result = summarise(results, Date.now() - startedAt);
  emit({ kind: "run:done", result });
  return result;
}

/**
 * Runs a rule and converts a thrown error into a reportable result.
 *
 * @remarks A rule that crashes must not take the run down with it: the other
 * rules still have something useful to say, and a broken rule is itself a
 * finding worth surfacing.
 * @param root - Absolute project root.
 * @param resolved - The rule and its settings.
 * @param files - The files discovery selected.
 * @param context - Shared resources.
 * @param startedAt - When the rule began, for timing.
 * @returns The rule's result.
 */
async function collect(
  root: string,
  resolved: ResolvedRule,
  files: string[],
  context: ReturnType<typeof createContext>["context"],
  startedAt: number,
): Promise<RuleResult> {
  const base = {
    ruleId: resolved.rule.id,
    title: resolved.rule.title,
    files: files.length,
  };

  try {
    const diagnostics = attribute(
      root,
      context,
      resolved,
      await runRule(resolved, files, context),
    );
    return { ...base, durationMs: Date.now() - startedAt, diagnostics };
  } catch (failure) {
    return {
      ...base,
      durationMs: Date.now() - startedAt,
      diagnostics: [],
      error: failure instanceof Error ? failure.message : String(failure),
    };
  }
}

/**
 * Totals the run.
 *
 * @param rules - Per-rule results.
 * @param durationMs - Wall-clock time for the run.
 * @returns The summary, counting a crashed rule as one error.
 */
function summarise(rules: RuleResult[], durationMs: number): RunResult {
  const diagnostics = rules.flatMap((result) => result.diagnostics);
  const crashed = rules.filter((result) => result.error).length;
  return {
    rules,
    errors:
      diagnostics.filter((entry) => entry.severity === "error").length +
      crashed,
    warnings: diagnostics.filter((entry) => entry.severity === "warn").length,
    durationMs,
  };
}
