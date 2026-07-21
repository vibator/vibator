/**
 * TSDoc analysis behind the {@link tsdocCoverage} rule.
 *
 * Ported from a repo-local gate and generalised: the walk is unchanged, but the
 * TypeScript module arrives as an argument and the file path is supplied by the
 * caller rather than derived from a hard-coded set of roots.
 *
 * @remarks Purely syntactic: no type checker is consulted, so this runs
 * without a tsconfig and costs a parse per file rather than a type-check.
 *
 * @packageDocumentation
 */
import type ts from "typescript";
import type { TypeScript } from "../deprecation-analysis.ts";
import { checkInlineCommentLength, checkMemberComments } from "./members.ts";
import { type AnalysisOptions, bind, type Violation } from "./state.ts";
import { checkSourceFile } from "./statements.ts";

/**
 * Collects every documentation violation in one file.
 *
 * @param typescript - The TypeScript module.
 * @param sourceFile - The parsed file.
 * @param file - Its repo-relative path, as reports should name it.
 * @param options - The rule's resolved options.
 * @returns The violations found.
 */
export function analyseFile(
  typescript: TypeScript,
  sourceFile: ts.SourceFile,
  file: string,
  options: AnalysisOptions,
): Violation[] {
  bind(typescript, file, options);

  const violations: Violation[] = [];
  checkSourceFile(sourceFile, violations);
  checkMemberComments(sourceFile, violations);
  checkInlineCommentLength(sourceFile, violations);
  return violations;
}

export type { AnalysisOptions, Violation } from "./state.ts";
