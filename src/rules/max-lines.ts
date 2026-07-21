/**
 * Rule: no source file longer than a budget.
 *
 * @packageDocumentation
 */
import { z } from "zod";
import type { Diagnostic } from "../core/diagnostic.ts";
import type { FileRule } from "../core/rule.ts";

/** Options for {@link maxLines}. */
const optionsSchema = z.object({
  /** Longest a file may be. */
  max: z
    .number()
    .int()
    .positive()
    .default(400)
    .describe("Longest a file may be, in lines"),
});

/**
 * Counts lines the way `wc -l` does.
 *
 * @param text - The file's contents.
 * @returns The line count, ignoring the empty string a trailing newline leaves.
 */
function countLines(text: string): number {
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.length;
}

/**
 * Flags files that have grown past the point of having one job.
 *
 * @remarks Linters cap function length; almost none cap file length. That gap
 * is where generated code accumulates: each edit adds one more handler to the
 * module it is already in, every change is individually reasonable, and the
 * file passes a thousand lines without any single commit looking wrong.
 */
export const maxLines: FileRule<z.infer<typeof optionsSchema>> = {
  id: "max-lines",
  title: "No source file longer than the budget",
  docs: "rules/max-lines.md",
  scope: "file",
  defaultSeverity: "error",
  defaultInclude: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
  defaultExclude: ["**/*.test.*", "**/*.spec.*", "**/*.d.ts"],
  optionsSchema,

  checkFile({ file, bytes, options }): Diagnostic[] {
    const lines = countLines(bytes.toString("utf8"));
    if (lines <= options.max) return [];

    return [
      {
        file,
        line: options.max + 1,
        message: `${lines} lines exceeds the ${options.max}-line budget`,
        expected: `At most ${options.max} lines`,
        fix: "Split it into focused modules, each with one reason to change",
      },
    ];
  },
};
