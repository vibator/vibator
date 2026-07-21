/**
 * The top-level walk: which statements face the documentation bar at all.
 *
 * @remarks Split from the checks themselves so each module has one job — this
 * one decides *what* is judged (and honours `requireOn: "exported"`), while
 * `functions.ts` and `members.ts` decide *how*.
 *
 * @packageDocumentation
 */
import type ts from "typescript";
import {
  checkClassMembers,
  checkFunction,
  checkVariableStatement,
} from "./functions.ts";
import { analysisOptions, syntax, type Violation } from "./state.ts";

/**
 * Whether a statement is exported from its module.
 *
 * @param statement - The statement to inspect.
 * @returns `true` when an `export` modifier is present.
 */
function isExported(statement: ts.Statement): boolean {
  const modifiers = (statement as { modifiers?: readonly ts.ModifierLike[] })
    .modifiers;
  return (modifiers ?? []).some(
    (modifier) => modifier.kind === syntax().SyntaxKind.ExportKeyword,
  );
}

/**
 * Checks one top-level statement, whichever documentable form it takes.
 *
 * @param sourceFile - The file the statement belongs to.
 * @param statement - The statement to inspect.
 * @param violations - The violation sink.
 */
function checkStatement(
  sourceFile: ts.SourceFile,
  statement: ts.Statement,
  violations: Violation[],
): void {
  if (syntax().isFunctionDeclaration(statement) && statement.name) {
    checkFunction(
      sourceFile,
      statement,
      statement,
      statement.name.text,
      violations,
    );
  } else if (syntax().isVariableStatement(statement)) {
    checkVariableStatement(sourceFile, statement, violations);
  } else if (syntax().isClassDeclaration(statement)) {
    checkClassMembers(sourceFile, statement, violations);
  }
}

/**
 * Checks every covered function-like in a source file.
 *
 * @remarks Under `requireOn: "exported"`, module-local declarations are left
 * alone: the bar applies only to the surface other files consume.
 * @param sourceFile - The parsed source file.
 * @param violations - The violation sink.
 */
export function checkSourceFile(
  sourceFile: ts.SourceFile,
  violations: Violation[],
): void {
  const localExempt = analysisOptions().requireOn === "exported";
  sourceFile.statements.forEach((statement) => {
    if (localExempt && !isExported(statement)) return;
    checkStatement(sourceFile, statement, violations);
  });
}
