/**
 * Documentation checks over type members, and the inline comment length bar.
 *
 * @packageDocumentation
 */
import type ts from "typescript";
import { hasLeadingComment, jsDocsOf, lineOf } from "./functions.ts";
import {
  analysisOptions,
  currentFile,
  syntax,
  type Violation,
} from "./state.ts";

type DocumentedMember =
  | ts.PropertySignature
  | ts.MethodSignature
  | ts.PropertyDeclaration
  | ts.EnumMember;

/**
 * Type guard for {@link DocumentedMember}: the "properties" of the rule, on
 * interfaces, type literals, classes, and enums alike.
 * @param node - The node to test.
 */
function isDocumentedMember(node: ts.Node): node is DocumentedMember {
  return (
    syntax().isPropertySignature(node) ||
    syntax().isMethodSignature(node) ||
    syntax().isPropertyDeclaration(node) ||
    syntax().isEnumMember(node)
  );
}

/**
 * Reports every member documented with a `//` comment instead of TSDoc.
 * @remarks Members that already carry a TSDoc block pass, so a `//` section
 * divider above one is still fine.
 * @param sourceFile - The file to scan.
 * @param violations - The violation sink.
 */
function checkMemberComments(
  sourceFile: ts.SourceFile,
  violations: Violation[],
): void {
  const visit = (node: ts.Node): void => {
    if (
      isDocumentedMember(node) &&
      jsDocsOf(node).length === 0 &&
      hasLeadingComment(sourceFile, node)
    ) {
      violations.push({
        file: currentFile(),
        line: lineOf(sourceFile, node.getStart()),
        symbol: node.name?.getText() ?? "(member)",
        problem: "document the member with TSDoc, not a `//` comment",
      });
    }
    syntax().forEachChild(node, visit);
  };
  syntax().forEachChild(sourceFile, visit);
}

/**
 * Records the `//` ranges attached to one token position.
 * @param sourceFile - The file being scanned.
 * @param position - A token's full start, whose trivia is read.
 * @param found - Sink keyed by range start, so shared trivia is stored once.
 */
function collectLineComments(
  sourceFile: ts.SourceFile,
  position: number,
  found: Map<number, ts.TextRange>,
): void {
  const leading =
    syntax().getLeadingCommentRanges(sourceFile.text, position) ?? [];
  const trailing =
    syntax().getTrailingCommentRanges(sourceFile.text, position) ?? [];
  for (const range of [...leading, ...trailing]) {
    if (range.kind !== syntax().SyntaxKind.SingleLineCommentTrivia) continue;
    found.set(range.pos, { pos: range.pos, end: range.end });
  }
}

/**
 * Every `//` comment in a file, as text ranges.
 * @remarks Read from the parsed tree's trivia rather than by re-lexing the
 * text. A bare scanner carries no parser context, so a backtick inside a TSDoc
 * block reads as a template literal and swallows every comment after it.
 * @param sourceFile - The file to scan.
 * @returns The ranges, in source order.
 */
function singleLineComments(sourceFile: ts.SourceFile): ts.TextRange[] {
  const found = new Map<number, ts.TextRange>();
  const visit = (node: ts.Node): void => {
    collectLineComments(sourceFile, node.getFullStart(), found);
    node.getChildren(sourceFile).forEach(visit);
  };
  visit(sourceFile);
  return [...found.values()].sort((left, right) => left.pos - right.pos);
}

/**
 * The lines carrying a `//` comment that opens its own line.
 * @remarks Only these form a block; a trailing `// note` after code is a single
 * remark, not part of a run.
 * @param sourceFile - The file to scan.
 * @returns The 1-based line numbers, in source order.
 */
function ownLineComments(sourceFile: ts.SourceFile): number[] {
  return singleLineComments(sourceFile)
    .filter((range) => {
      const lineStart =
        sourceFile.getLineStarts()[lineOf(sourceFile, range.pos) - 1] ?? 0;
      return sourceFile.text.slice(lineStart, range.pos).trim() === "";
    })
    .map((range) => lineOf(sourceFile, range.pos));
}

/**
 * Groups comment lines into runs.
 * @remarks Consecutive `//` lines are one block; a blank line or any code ends
 * it.
 * @param lines - The own-line comment lines, in source order.
 * @returns A map from each run's first line to its length.
 */
function commentRunLengths(lines: number[]): Map<number, number> {
  const runs = new Map<number, number>();
  let start = -1;
  let previous = -2;
  for (const line of lines) {
    if (line !== previous + 1) start = line;
    runs.set(start, (runs.get(start) ?? 0) + 1);
    previous = line;
  }
  return runs;
}

/**
 * Reports every `//` run longer than the configured cap — past it, the run is
 * an explanation that belongs in the enclosing TSDoc.
 * @param sourceFile - The file to scan.
 * @param violations - The violation sink.
 */
function checkInlineCommentLength(
  sourceFile: ts.SourceFile,
  violations: Violation[],
): void {
  const cap = analysisOptions().maxInlineCommentLines;
  for (const [line, length] of commentRunLengths(ownLineComments(sourceFile))) {
    if (length <= cap) continue;
    violations.push({
      file: currentFile(),
      line,
      symbol: "(inline comment)",
      problem: `${length}-line \`//\` block exceeds ${cap}; move it into the enclosing TSDoc`,
    });
  }
}

/**
 * Checks every covered function-like in a source file.
 * @param sourceFile - The parsed source file.
 * @param violations - The violation sink.
 */
export { checkInlineCommentLength, checkMemberComments };
