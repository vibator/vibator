/**
 * State shared by the TSDoc analysis modules for the duration of one walk.
 *
 * @remarks The walk is a deep recursion through helpers that would otherwise
 * thread two unchanging values — the TypeScript module and the file's name —
 * through every frame. Binding them per file keeps the ported logic readable.
 * A run is single-threaded and files are walked one at a time, so there is no
 * interleaving for this to get wrong.
 *
 * @packageDocumentation
 */
import type { TypeScript } from "../deprecation-analysis.ts";

/** The knobs the {@link tsdocCoverage} rule exposes, resolved from config. */
export interface AnalysisOptions {
  /** Which declarations must carry documentation. */
  requireOn: "all" | "exported";
  /** Whether every parameter needs a `@param` tag. */
  requireParams: boolean;
  /** Whether value-returning signatures need a `@returns` tag. */
  requireReturns: boolean;
  /** Longest run of consecutive own-line `//` comments allowed. */
  maxInlineCommentLines: number;
}

/** The TypeScript module, bound for the duration of one walk. */
let boundTypeScript: TypeScript | undefined;

/** The file currently being walked, as reports should name it. */
let boundFile = "";

/** The options in force for the walk. */
let boundOptions: AnalysisOptions = {
  requireOn: "all",
  requireParams: true,
  requireReturns: true,
  maxInlineCommentLines: 2,
};

/** A documentation violation, pointing at the offending declaration. */
export interface Violation {
  /** Repo-relative path of the file. */
  file: string;
  /** 1-based line the declaration starts on. */
  line: number;
  /** The declaration being reported. */
  symbol: string;
  /** What the reader should change. */
  problem: string;
}

/** Records one violation against the declaration currently being checked. */
export type Report = (problem: string) => void;

/**
 * Binds the module, file and options for the walk about to run.
 *
 * @param typescript - The TypeScript module.
 * @param file - The file's repo-relative path.
 * @param analysisOptions - The rule's resolved options.
 */
export function bind(
  typescript: TypeScript,
  file: string,
  analysisOptions: AnalysisOptions,
): void {
  boundTypeScript = typescript;
  boundFile = file;
  boundOptions = analysisOptions;
}

/**
 * The options in force for the current walk.
 *
 * @returns The bound options.
 */
export function analysisOptions(): AnalysisOptions {
  return boundOptions;
}

/**
 * The bound TypeScript module.
 *
 * @returns The module.
 * @throws When called outside a walk, which is a programming error.
 */
export function syntax(): TypeScript {
  if (!boundTypeScript) throw new Error("TSDoc analysis used before bind()");
  return boundTypeScript;
}

/**
 * The file currently being walked.
 *
 * @returns Its repo-relative path.
 */
export function currentFile(): string {
  return boundFile;
}
