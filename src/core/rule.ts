/**
 * The rule contract every check implements.
 *
 * @packageDocumentation
 */
import type { ZodType } from "zod";
import type { RuleContext } from "./context.ts";
import type { Diagnostic, Severity } from "./diagnostic.ts";

/** What a rule needs to judge one file. */
export interface FileRuleInput<Options> {
  /** Repo-relative path of the file. */
  file: string;
  /** Its raw bytes, so binary content can be detected rather than mangled. */
  bytes: Buffer;
  /** The rule's validated options. */
  options: Options;
  /** Shared, memoized resources. */
  context: RuleContext;
}

/** What a rule needs to judge the project as a whole. */
export interface ProjectRuleInput<Options> {
  /** Repo-relative paths this rule's globs selected. */
  files: string[];
  /** The rule's validated options. */
  options: Options;
  /** Shared, memoized resources. */
  context: RuleContext;
}

/** The metadata every rule carries, whatever its scope. */
interface RuleBase<Options> {
  /** Stable kebab-case identifier, used as the config key. */
  id: string;
  /** One line describing what the rule enforces. */
  title: string;
  /** Path to the guideline, relative to the package's `docs/` directory. */
  docs: string;
  /** Severity applied when config does not say otherwise. */
  defaultSeverity: Severity;
  /** Globs selecting the files this rule judges, overridable per project. */
  defaultInclude: string[];
  /** Globs removed from that selection, overridable per project. */
  defaultExclude?: string[];
  /** Validates and defaults the `options` block from config. */
  optionsSchema: ZodType<Options>;
}

/**
 * A rule judging one file at a time.
 *
 * @remarks The engine iterates and reports progress, so per-file rules get
 * accurate counters for free and cannot forget to emit them.
 */
export interface FileRule<Options> extends RuleBase<Options> {
  /** Discriminant. */
  scope: "file";
  /**
   * Judges a single file.
   *
   * @param input - The file and the rule's options.
   * @returns Any findings in that file.
   */
  checkFile(input: FileRuleInput<Options>): Diagnostic[];
}

/**
 * A rule judging the project as a whole.
 *
 * @remarks For questions no single file can answer: whether two locales agree,
 * whether generated output still matches its source.
 */
export interface ProjectRule<Options> extends RuleBase<Options> {
  /** Discriminant. */
  scope: "project";
  /**
   * Judges the selected files together.
   *
   * @param input - The file set and the rule's options.
   * @returns Any findings.
   */
  check(input: ProjectRuleInput<Options>): Diagnostic[] | Promise<Diagnostic[]>;
}

/** Either kind of rule. */
export type Rule<Options = unknown> = FileRule<Options> | ProjectRule<Options>;

/** A rule with its options type erased, as the registry stores them. */
// biome-ignore lint/suspicious/noExplicitAny: the registry is heterogeneous by nature; each rule validates its own options through its schema at load time.
export type AnyRule = Rule<any>;
