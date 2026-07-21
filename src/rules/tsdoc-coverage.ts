/**
 * Rule: every declaration carries a complete TSDoc contract.
 *
 * @packageDocumentation
 */
import { z } from "zod";
import type { Diagnostic } from "../core/diagnostic.ts";
import type { ProjectRule } from "../core/rule.ts";
import { forEachParsedFile, loadTypeScript } from "./ts-support.ts";
import { analyseFile } from "./tsdoc/index.ts";

/** Options for {@link tsdocCoverage}. */
const optionsSchema = z.object({
  /**
   * Which declarations must carry documentation. `all` is this package's own
   * standard; `exported` asks only for the surface other files consume, which
   * is the gentler bar for a codebase adopting the rule late.
   */
  requireOn: z
    .enum(["all", "exported"])
    .default("all")
    .describe("Which declarations must carry documentation"),
  /** Whether every parameter needs a `@param` tag. */
  requireParams: z
    .boolean()
    .default(true)
    .describe("Whether every parameter needs a @param tag"),
  /** Whether value-returning signatures need a `@returns` tag. */
  requireReturns: z
    .boolean()
    .default(true)
    .describe("Whether value-returning signatures need a @returns tag"),
  /** Longest run of consecutive own-line `//` comments allowed. */
  maxInlineCommentLines: z
    .number()
    .int()
    .positive()
    .default(2)
    .describe("Longest run of consecutive own-line // comments allowed"),
});

/**
 * Flags declarations missing documentation, or documenting it wrongly.
 *
 * @remarks Covers the contract, not the prose: a TSDoc block on every
 * function-like and type member, a `@param` per parameter, a `@returns` when
 * something is returned, and `//` runs kept short enough that explanation lives
 * in the doc block rather than beside it. Whether the words are any good stays
 * a human question.
 */
export const tsdocCoverage: ProjectRule<z.infer<typeof optionsSchema>> = {
  id: "tsdoc-coverage",
  title: "Every declaration carries a complete TSDoc contract",
  docs: "rules/tsdoc-coverage.md",
  scope: "project",
  defaultSeverity: "error",
  defaultInclude: ["**/src/**/*.{ts,tsx}"],
  defaultExclude: ["**/*.test.*", "**/*.spec.*", "**/*.d.ts"],
  optionsSchema,

  async check({ files, options, context }): Promise<Diagnostic[]> {
    if (files.length === 0) return [];

    const typescript = await loadTypeScript(context.root);

    return forEachParsedFile(context, files, typescript, (sourceFile, file) =>
      analyseFile(typescript, sourceFile, file, options).map((violation) => ({
        file: violation.file,
        line: violation.line,
        message: `${violation.symbol}: ${violation.problem}`,
        expected:
          "A TSDoc block stating the contract, with @param and @returns where due",
        fix: "Document the declaration; `//` above a declaration is documentation in the wrong form",
      })),
    );
  },
};
