/**
 * The one shape every rule reports in.
 *
 * @packageDocumentation
 */

/** How much a finding matters. `off` disables the rule entirely. */
export type Severity = "error" | "warn" | "off";

/**
 * A single finding.
 *
 * @remarks The three message fields are deliberately separate rather than one
 * prose blob. A human reads them as one sentence, but an agent reading JSON can
 * act on {@link Diagnostic.fix} without parsing intent out of English, which is
 * the difference between a gate that reports and a gate that unblocks.
 */
export interface Diagnostic {
  /** Repo-relative path, absent for findings about the project as a whole. */
  file?: string;
  /** 1-based line. */
  line?: number;
  /** 1-based column. */
  column?: number;
  /** What is wrong, stated plainly. */
  message: string;
  /** What the rule required instead. */
  expected?: string;
  /** The concrete next action that resolves it. */
  fix?: string;
}

/**
 * A guideline attached to a finding.
 *
 * @remarks Split into a display path and a resolved one because the two answer
 * different questions. The display path is what the rule or config wrote; the
 * resolved path is one an editor or an agent can open directly, without knowing
 * whether the document ships inside this package or lives in the project.
 */
export interface GuidelineReference {
  /** The path as the rule or config states it. */
  path: string;
  /** Absolute path of the document, when it was found on disk. */
  absolutePath?: string;
}

/** A diagnostic once the engine has attached its rule and resolved severity. */
export interface ReportedDiagnostic extends Diagnostic {
  /** The rule that produced it. */
  ruleId: string;
  /** Severity resolved from config, never `off`. */
  severity: Exclude<Severity, "off">;
  /** The guideline in force, first, then any project documents mapped to it. */
  docs: GuidelineReference[];
  /** A few source lines around the finding, when it points at one. */
  snippet?: string;
}

/**
 * Renders a diagnostic's location as `path:line:column`.
 *
 * @param diagnostic - The finding to locate.
 * @returns The location, or `"<project>"` for findings with no file.
 */
export function locationOf(diagnostic: Diagnostic): string {
  if (!diagnostic.file) return "<project>";
  if (diagnostic.line === undefined) return diagnostic.file;
  if (diagnostic.column === undefined)
    return `${diagnostic.file}:${diagnostic.line}`;
  return `${diagnostic.file}:${diagnostic.line}:${diagnostic.column}`;
}
