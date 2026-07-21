/**
 * Shared plumbing for the rules that need a type-checked program.
 *
 * @packageDocumentation
 */
import { relative, resolve } from "node:path";
import type ts from "typescript";
import { z } from "zod";
import type { RuleContext } from "../core/context.ts";
import type { Diagnostic } from "../core/diagnostic.ts";

/**
 * The tsconfig list every AST rule accepts.
 *
 * @remarks Programs are memoized on the context, so several rules naming the
 * same projects cost one type-check between them rather than one each.
 */
export const projectsSchema = z
  .array(z.string())
  .min(1)
  .default(["tsconfig.json"])
  .describe("tsconfig paths whose programs this rule resolves against");

/** What a per-file visitor receives. */
export interface VisitInput {
  /** The parsed and type-resolved file. */
  sourceFile: ts.SourceFile;
  /** The checker for the program that file came from. */
  checker: ts.TypeChecker;
  /** The file's repo-relative path. */
  file: string;
}

/**
 * Loads the TypeScript module on demand.
 *
 * @remarks Dynamic so `typescript` stays an optional peer: a project running
 * only the file-based rules never pays for it and never has to install it.
 * @returns The TypeScript module.
 * @throws With an install hint when TypeScript is not present.
 */
export async function loadTypeScript(): Promise<typeof ts> {
  const loaded = await import("typescript").catch(() => {
    throw new Error(
      "This rule needs TypeScript, which is an optional peer dependency.\n" +
        "Install it with: npm install --save-dev typescript",
    );
  });
  return loaded.default;
}

/**
 * Converts an absolute path to the repo-relative form reports use.
 *
 * @param root - Absolute project root.
 * @param fileName - Absolute path from the program.
 * @returns The forward-slashed relative path.
 */
function toRelative(root: string, fileName: string): string {
  return relative(root, fileName).replaceAll("\\", "/");
}

/**
 * Runs a visitor over every in-scope source file across the given projects.
 *
 * @remarks A file appearing in two projects is visited once: rules report
 * findings keyed by position, and visiting twice would double every one of
 * them. The rule's own glob selection is the filter, so a project pulling in
 * files the rule was never pointed at is ignored rather than reported.
 * @param context - Shared resources.
 * @param projects - tsconfig paths, relative to the root.
 * @param files - The rule's discovered files, as a scope filter.
 * @param visit - Called per file; returns that file's findings.
 * @returns Every finding, in file order.
 */
export async function forEachSourceFile(
  context: RuleContext,
  projects: string[],
  files: string[],
  visit: (input: VisitInput) => Diagnostic[],
): Promise<Diagnostic[]> {
  // No files, no program. Building one costs seconds, and a project with no
  // TypeScript would otherwise fail on a tsconfig it was never going to use.
  if (files.length === 0) return [];

  const inScope = new Set(files.map((file) => resolve(context.root, file)));
  const seen = new Set<string>();
  const found: Diagnostic[] = [];
  let done = 0;

  for (const project of projects) {
    const program = (await context.program(project)) as unknown as ts.Program;
    const checker = program.getTypeChecker();

    for (const sourceFile of program.getSourceFiles()) {
      const absolute = resolve(sourceFile.fileName);
      if (!inScope.has(absolute) || seen.has(absolute)) continue;
      seen.add(absolute);

      found.push(
        ...visit({
          sourceFile,
          checker,
          file: toRelative(context.root, sourceFile.fileName),
        }),
      );
      done += 1;
      context.progress(done, inScope.size);
    }
  }

  context.progress(inScope.size, inScope.size);
  return found;
}

/**
 * The parser mode a file's extension implies.
 *
 * @remarks Getting this wrong is quiet rather than loud: a `.jsx` file parsed
 * as TypeScript reads its JSX as type assertions and produces parse errors that
 * nothing surfaces, leaving the rule to walk a misparsed tree.
 * @param typescript - The TypeScript module.
 * @param file - The file being parsed.
 * @returns The script kind for that extension.
 */
function scriptKindFor(typescript: typeof ts, file: string): ts.ScriptKind {
  if (file.endsWith(".tsx")) return typescript.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return typescript.ScriptKind.JSX;
  if (/\.(js|mjs|cjs)$/.test(file)) return typescript.ScriptKind.JS;
  return typescript.ScriptKind.TS;
}

/**
 * Runs a syntax-only visitor over each file, parsing it directly.
 *
 * @remarks Most AST rules ask questions about *shape* — how long a name is,
 * whether a doc comment is present — and never consult a type. Those need no
 * tsconfig and no program, which makes them an order of magnitude cheaper and
 * lets them run in projects that have no TypeScript configuration at all.
 *
 * The tree is memoized on the context for the same reason programs are: three
 * of this package's rules walk the same files, and parsing per rule made one
 * parse into three. The trees are read-only here — every visitor asks questions
 * and none rewrites — so sharing one is safe.
 * @param context - Shared resources.
 * @param files - The rule's discovered files.
 * @param typescript - The TypeScript module.
 * @param visit - Called per file; returns that file's findings.
 * @returns Every finding, in file order.
 */
export function forEachParsedFile(
  context: RuleContext,
  files: string[],
  typescript: typeof ts,
  visit: (sourceFile: ts.SourceFile, file: string) => Diagnostic[],
): Diagnostic[] {
  if (files.length === 0) return [];

  return files.flatMap((file, index) => {
    const sourceFile = context.memo("sourceFile", file, () =>
      typescript.createSourceFile(
        file,
        context.read(file),
        typescript.ScriptTarget.Latest,
        true,
        scriptKindFor(typescript, file),
      ),
    );
    const found = visit(sourceFile, file);
    context.progress(index + 1, files.length);
    return found;
  });
}

/**
 * The marker every project gets unless it configures its own.
 *
 * @remarks Configurable because a project adopting this package usually already
 * has an escape hatch in its source. Silently renaming it would void every
 * existing exemption at once and bury the real findings under them.
 */
const DEFAULT_IGNORE_MARKERS = ["vibator-ignore"];

/** The option both style rules expose for naming their escape hatch. */
export const ignoreMarkersSchema = z
  .array(z.string())
  .default(DEFAULT_IGNORE_MARKERS)
  .describe("comment markers that opt a line out, each requiring a reason");

/**
 * Whether the line above a node carries a reasoned ignore comment.
 *
 * @remarks The bare marker does not match — only one followed by a reason. An
 * unexplained exemption is the drift these rules exist to stop.
 * @param sourceFile - The file being checked.
 * @param node - The node whose exemption is in question.
 * @param markers - The accepted marker words.
 * @returns `true` when the preceding line opts this node out with a reason.
 */
export function hasInlineIgnore(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  markers: string[],
): boolean {
  const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
  if (line === 0) return false;

  const starts = sourceFile.getLineStarts();
  const previous = sourceFile.text.slice(starts[line - 1] ?? 0, starts[line]);
  return markers.some((marker) =>
    new RegExp(`//\\s*${marker}:\\s*\\S`).test(previous),
  );
}

/**
 * The 1-based line a position falls on.
 *
 * @param sourceFile - The file being read.
 * @param position - A character offset into it.
 * @returns The line number as reports show it.
 */
export function lineAt(sourceFile: ts.SourceFile, position: number): number {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}
