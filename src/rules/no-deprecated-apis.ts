/**
 * Rule: no use of APIs marked `@deprecated`.
 *
 * @packageDocumentation
 */
import type ts from "typescript";
import { z } from "zod";
import type { Diagnostic } from "../core/diagnostic.ts";
import type { ProjectRule } from "../core/rule.ts";
import { deprecatedUse, type TypeScript } from "./deprecation-analysis.ts";
import {
  forEachSourceFile,
  lineAt,
  loadTypeScript,
  projectsSchema,
} from "./ts-support.ts";

/** Options for {@link noDeprecatedApis}. */
const optionsSchema = z.object({
  projects: projectsSchema,
});

/**
 * Walks one file, collecting every deprecated usage in it.
 *
 * @param typescript - The TypeScript module.
 * @param checker - The program's type checker.
 * @param sourceFile - The file to walk.
 * @param file - Its repo-relative path.
 * @returns The findings in that file.
 */
function walk(
  typescript: TypeScript,
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
  file: string,
): Diagnostic[] {
  const found: Diagnostic[] = [];

  const visit = (node: ts.Node): void => {
    const used = deprecatedUse(typescript, checker, node);
    if (used) {
      found.push({
        file,
        line: lineAt(sourceFile, used.node.getStart()),
        message: `${used.node.text} is deprecated`,
        expected: used.replacement,
        fix: `Replace ${used.node.text} — ${used.replacement}`,
      });
    }
    typescript.forEachChild(node, visit);
  };

  visit(sourceFile);
  return found;
}

/**
 * Flags calls and references reaching a `@deprecated` declaration.
 *
 * @remarks Deprecation is the one compiler signal deliberately not an error:
 * the code keeps building and keeps working right up to the major release that
 * deletes it. Editors strike it through and nothing else notices — least of all
 * a generated patch, which reproduces whatever pattern was most common in its
 * training data and so reaches for the older API more often than the newer one.
 */
export const noDeprecatedApis: ProjectRule<z.infer<typeof optionsSchema>> = {
  id: "no-deprecated-apis",
  title: "No use of APIs marked @deprecated",
  docs: "rules/no-deprecated-apis.md",
  scope: "project",
  defaultSeverity: "error",
  defaultInclude: ["**/src/**/*.{ts,tsx}", "*.config.ts"],
  defaultExclude: ["**/*.d.ts"],
  optionsSchema,

  async check({ files, options, context }): Promise<Diagnostic[]> {
    if (files.length === 0) return [];

    const typescript = await loadTypeScript();
    return forEachSourceFile(
      context,
      options.projects,
      files,
      ({ sourceFile, checker, file }) =>
        walk(typescript, checker, sourceFile, file),
    );
  },
};
