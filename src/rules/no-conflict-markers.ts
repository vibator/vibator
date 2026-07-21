/**
 * Rule: no unresolved merge conflict markers.
 *
 * @packageDocumentation
 */
import { z } from "zod";
import type { Diagnostic } from "../core/diagnostic.ts";
import type { FileRule } from "../core/rule.ts";

/**
 * The four markers git writes, anchored to the start of a line.
 *
 * @remarks `<<<<<<< `, `||||||| ` and `>>>>>>> ` keep their trailing space so a
 * row of angle brackets in prose does not match. `|||||||` only appears under
 * `diff3`, which is why it is the one people forget.
 */
const CONFLICT_MARKER = /^(?:<<<<<<< |\|\|\|\|\|\|\| |={7}$|>>>>>>> )/;

/** Options for {@link noConflictMarkers}. */
const optionsSchema = z.object({});

/**
 * Flags files carrying a marker from an abandoned merge.
 *
 * @remarks TypeScript would fail to compile with one of these in it, but JSON,
 * Markdown, SQL migrations and locale files accept them silently and ship.
 */
export const noConflictMarkers: FileRule<z.infer<typeof optionsSchema>> = {
  id: "no-conflict-markers",
  title: "No unresolved merge conflict markers",
  docs: "rules/no-conflict-markers.md",
  scope: "file",
  defaultSeverity: "error",
  defaultInclude: ["**/*"],
  optionsSchema,

  checkFile({ file, bytes }): Diagnostic[] {
    if (bytes.includes(0)) return [];

    const lines = bytes.toString("utf8").split("\n");
    const index = lines.findIndex((line) => CONFLICT_MARKER.test(line));
    if (index === -1) return [];

    return [
      {
        file,
        line: index + 1,
        message: `Unresolved merge conflict marker: ${lines[index]?.slice(0, 24)}`,
        expected: "No conflict markers in committed files",
        fix: "Finish the merge and delete the <<<<<<<, =======, >>>>>>> lines",
      },
    ];
  },
};
