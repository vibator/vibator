/**
 * Rule: identifiers we declare carry meaning.
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

/** Options for {@link meaningfulNames}. */
const optionsSchema = z.object({
  /** Comment markers that opt a declaration out, each requiring a reason. */
  ignoreMarkers: ignoreMarkersSchema,
  /** Identifiers shorter than this must be allowlisted. */
  minLength: z
    .number()
    .int()
    .positive()
    .default(3)
    .describe("Identifiers shorter than this must be allowlisted"),
  /** Short names that carry meaning, or that a library imposes. */
  allow: z
    .array(z.string())
    .default(["id", "ip", "ok", "db", "on", "to", "up", "x", "y", "z"])
    .describe("Short names that carry meaning, or that a library imposes"),
  /** Names long enough to pass the bar but still meaningless. */
  deny: z
    .array(z.string())
    .default([
      "data",
      "temp",
      "tmp",
      "arr",
      "obj",
      "val",
      "err",
      "res",
      "req",
      "evt",
      "idx",
      "num",
      "str",
      "buf",
      "elem",
      "btn",
      "msg",
      "env",
      "ret",
      "ctx",
      "cfg",
      "opts",
      "info",
      "misc",
      "stuff",
      "foo",
      "bar",
      "baz",
    ])
    .describe("Names long enough to pass the bar but still meaningless"),
});

/** The resolved options this rule works from. */
type Options = z.infer<typeof optionsSchema>;

/**
 * The declaration forms whose names we choose ourselves.
 *
 * @remarks A caught error is reached through its own variable declaration, so
 * the catch clause is not matched; doing both reports it twice. Properties are
 * excluded: they may mirror wire shapes and library contracts whose names we do
 * not choose.
 * @param typescript - The TypeScript module.
 * @param node - Any node.
 * @returns `true` for the forms this rule judges.
 */
function isOwnNameDeclaration(typescript: TypeScript, node: ts.Node): boolean {
  return (
    typescript.isParameter(node) ||
    typescript.isVariableDeclaration(node) ||
    typescript.isBindingElement(node) ||
    typescript.isFunctionDeclaration(node) ||
    typescript.isMethodDeclaration(node) ||
    typescript.isClassDeclaration(node) ||
    typescript.isInterfaceDeclaration(node) ||
    typescript.isTypeAliasDeclaration(node) ||
    typescript.isEnumDeclaration(node)
  );
}

/**
 * The problem with a name, if there is one.
 *
 * @param name - The declared identifier text.
 * @param options - The rule's options.
 * @returns A description of the problem, or `undefined` when the name is fine.
 */
function problemWith(name: string, options: Options): string | undefined {
  if (name.startsWith("_")) return undefined;
  if (options.deny.includes(name)) {
    return `"${name}" is a filler name that says nothing about the value`;
  }
  if (name.length < options.minLength && !options.allow.includes(name)) {
    return `"${name}" is too short to carry meaning`;
  }
  return undefined;
}

/**
 * Judges the name a single declaration introduces.
 *
 * @param typescript - The TypeScript module.
 * @param sourceFile - The file being walked.
 * @param node - The node to inspect.
 * @param options - The rule's options.
 * @returns A finding without its file, or `undefined` when the name is fine.
 */
function checkDeclaration(
  typescript: TypeScript,
  sourceFile: ts.SourceFile,
  node: ts.Node,
  options: Options,
): Omit<Diagnostic, "file"> | undefined {
  if (!isOwnNameDeclaration(typescript, node)) return undefined;

  const { name } = node as ts.NamedDeclaration;
  if (!name || !typescript.isIdentifier(name)) return undefined;

  const problem = problemWith(name.text, options);
  if (!problem) return undefined;
  if (hasInlineIgnore(sourceFile, node, options.ignoreMarkers))
    return undefined;

  return {
    line: lineAt(sourceFile, name.getStart()),
    message: problem,
    expected: "A name that says what the value is",
    fix: "Rename it, or add `// vibator-ignore: <reason>` above if it genuinely earns the exception",
  };
}

/**
 * Walks one file, collecting poorly named declarations.
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
    const finding = checkDeclaration(typescript, sourceFile, node, options);
    if (finding) found.push({ ...finding, file });
    typescript.forEachChild(node, visit);
  };

  visit(sourceFile);
  return found;
}

/**
 * Flags identifiers too short or too generic to mean anything.
 *
 * @remarks Naming is where generated code drifts fastest: `data`, `res`, `tmp`
 * and `item` are the highest-frequency identifiers in any training corpus, so
 * they are what a model reaches for by default. No type checker objects.
 */
export const meaningfulNames: ProjectRule<Options> = {
  id: "meaningful-names",
  title: "Identifiers we declare carry meaning",
  docs: "rules/meaningful-names.md",
  scope: "project",
  defaultSeverity: "error",
  defaultInclude: ["**/src/**/*.{ts,tsx}"],
  defaultExclude: ["**/*.d.ts"],
  optionsSchema,

  async check({ files, options, context }): Promise<Diagnostic[]> {
    if (files.length === 0) return [];

    const typescript = await loadTypeScript(context.root);
    return forEachParsedFile(context, files, typescript, (sourceFile, file) =>
      walk(typescript, sourceFile, file, options),
    );
  },
};
