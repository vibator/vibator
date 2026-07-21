/**
 * Rule: no oversized files in version control.
 *
 * @packageDocumentation
 */
import { z } from "zod";
import type { Diagnostic } from "../core/diagnostic.ts";
import type { FileRule } from "../core/rule.ts";

/** Options for {@link maxFileSize}. */
const optionsSchema = z.object({
  /** Largest accepted file, in kilobytes. */
  maxKb: z
    .number()
    .int()
    .positive()
    .default(400)
    .describe("Largest accepted file, in kilobytes"),
});

/**
 * Flags files large enough to be a committed artifact rather than source.
 *
 * @remarks Build output, database dumps, screenshots and vendored binaries
 * bloat every clone forever: deleting one later does not remove it from
 * history, so the only cheap moment to catch it is before it lands.
 */
export const maxFileSize: FileRule<z.infer<typeof optionsSchema>> = {
  id: "max-file-size",
  title: "No oversized files in version control",
  docs: "rules/max-file-size.md",
  scope: "file",
  defaultSeverity: "error",
  defaultInclude: ["**/*"],
  optionsSchema,

  checkFile({ file, bytes, options }): Diagnostic[] {
    const limit = options.maxKb * 1024;
    if (bytes.byteLength <= limit) return [];

    return [
      {
        file,
        message: `${Math.round(bytes.byteLength / 1024)} KB exceeds the ${options.maxKb} KB budget`,
        expected: `At most ${options.maxKb} KB`,
        fix: "Commit the source, not the artifact, or add this path to the rule's exclude globs if it is a generated file that must be tracked",
      },
    ];
  },
};
