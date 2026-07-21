/**
 * Rule: a loop whose body is one statement is an array method written long.
 *
 * @packageDocumentation
 */
import type ts from "typescript";
import { z } from "zod";
import type { Diagnostic } from "../core/diagnostic.ts";
import type { ProjectRule } from "../core/rule.ts";
import type { TypeScript } from "./deprecation-analysis.ts";
import {
  forEachParsedFile,
  hasInlineIgnore,
  ignoreMarkersSchema,
  lineAt,
  loadTypeScript,
} from "./ts-support.ts";

/** Options for {@link preferArrayMethods}. */
const optionsSchema = z.object({
  ignoreMarkers: ignoreMarkersSchema,
});

/** The resolved options this rule works from. */
type Options = z.infer<typeof optionsSchema>;

/**
 * Whether a loop body contains control flow an array method cannot express.
 *
 * @remarks `break`, `continue` and `await` are the honest reasons to keep a
 * loop, so a body using any of them is left alone. Nested functions are not
 * descended into: a `break` there belongs to some inner loop, not this one.
 * @param typescript - The TypeScript module.
 * @param body - The loop body.
 * @returns `true` when the loop earns its place.
 */
function hasEscapingControlFlow(
  typescript: TypeScript,
  body: ts.Node,
): boolean {
  let escapes = false;

  const visit = (node: ts.Node): void => {
    if (escapes) return;
    if (
      typescript.isBreakStatement(node) ||
      typescript.isContinueStatement(node) ||
      typescript.isAwaitExpression(node) ||
      typescript.isReturnStatement(node)
    ) {
      escapes = true;
      return;
    }
    if (
      typescript.isFunctionDeclaration(node) ||
      typescript.isFunctionExpression(node) ||
      typescript.isArrowFunction(node)
    ) {
      return;
    }
    typescript.forEachChild(node, visit);
  };

  visit(body);
  return escapes;
}

/**
 * How many statements a loop body holds.
 *
 * @param typescript - The TypeScript module.
 * @param body - The loop body.
 * @returns The statement count, treating a bare statement as one.
 */
function statementCount(typescript: TypeScript, body: ts.Statement): number {
  return typescript.isBlock(body) ? body.statements.length : 1;
}

/**
 * Walks one file, collecting loops that should be array methods.
 *
 * @param typescript - The TypeScript module.
 * @param sourceFile - The file to walk.
 * @param file - Its repo-relative path.
 * @param options - The rule's options.
 * @returns The findings in that file.
 */
function walk(
  typescript: TypeScript,
  sourceFile: ts.SourceFile,
  file: string,
  options: Options,
): Diagnostic[] {
  const found: Diagnostic[] = [];

  const visit = (node: ts.Node): void => {
    const isLoop =
      typescript.isForStatement(node) ||
      typescript.isForOfStatement(node) ||
      typescript.isForInStatement(node);

    if (isLoop) {
      const loop = node as ts.IterationStatement;
      if (
        statementCount(typescript, loop.statement) === 1 &&
        !hasEscapingControlFlow(typescript, loop.statement) &&
        !hasInlineIgnore(sourceFile, node, options.ignoreMarkers)
      ) {
        found.push({
          file,
          line: lineAt(sourceFile, node.getStart()),
          message:
            "Loop body is a single statement with no break, continue, return or await",
          expected: "An array method that names the operation",
          fix: "Use forEach, map, filter, flatMap or reduce — or add `// vibator-ignore: <reason>` above if the loop reads better",
        });
      }
    }
    typescript.forEachChild(node, visit);
  };

  visit(sourceFile);
  return found;
}

/**
 * Flags manual loops that an array method would express more clearly.
 *
 * @remarks Not a blanket ban on loops: only bodies of a single statement with
 * no escaping control flow, where the array method is strictly clearer because
 * its name states the operation. Ships as `warn` rather than `error` — the
 * check is syntactic, so a loop over a `Set`, a `Map` or a generator, none of
 * which carry `map` or `filter`, can be flagged although rewriting it is not
 * strictly possible. That is what the ignore marker and the severity are for.
 */
export const preferArrayMethods: ProjectRule<Options> = {
  id: "prefer-array-methods",
  title: "Array methods over single-statement loops",
  docs: "rules/prefer-array-methods.md",
  scope: "project",
  defaultSeverity: "warn",
  defaultInclude: ["**/src/**/*.{ts,tsx}"],
  defaultExclude: ["**/*.d.ts"],
  optionsSchema,

  async check({ files, options, context }): Promise<Diagnostic[]> {
    if (files.length === 0) return [];

    const typescript = await loadTypeScript();
    return forEachParsedFile(context, files, typescript, (sourceFile, file) =>
      walk(typescript, sourceFile, file, options),
    );
  },
};
