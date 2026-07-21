/**
 * Rule: project-banned patterns stay out of the source.
 *
 * @packageDocumentation
 */
import { z } from "zod";
import type { Diagnostic } from "../core/diagnostic.ts";
import { hasLineIgnoreAbove } from "../core/ignore.ts";
import type { FileRule } from "../core/rule.ts";

/** One banned pattern, with the three diagnostic fields it reports. */
const patternSchema = z.object({
  /** JavaScript regular expression source matched against each line. */
  pattern: z
    .string()
    .describe("JavaScript regular expression source, matched per line"),
  /** Regular expression flags, such as `i`. */
  flags: z.string().default("").describe("Regular expression flags, such as i"),
  /** What is wrong when the pattern matches. */
  message: z.string().describe("What is wrong when the pattern matches"),
  /** The standard, positively stated. */
  expected: z.string().describe("The standard, positively stated"),
  /** The concrete next action. */
  fix: z.string().describe("The concrete next action"),
});

/** Options for {@link bannedPatterns}. */
const optionsSchema = z.object({
  /** The patterns to ban, each carrying its own diagnostic text. */
  patterns: z
    .array(patternSchema)
    .min(1)
    .describe("The patterns to ban, each carrying its own diagnostic text"),
  /** Comment markers that opt a line out, each requiring a reason. */
  ignoreMarkers: z
    .array(z.string())
    .default(["vibator-ignore"])
    .describe("Comment markers that opt a line out, each requiring a reason"),
});

/** One configured pattern. */
type BannedPattern = z.infer<typeof patternSchema>;

/**
 * Finds every line one pattern matches.
 *
 * @param file - The file being judged.
 * @param lines - Its lines.
 * @param banned - The pattern and its diagnostic text.
 * @param markers - The accepted ignore markers.
 * @returns One diagnostic per matching line not opted out.
 */
function matchesOf(
  file: string,
  lines: string[],
  banned: BannedPattern,
  markers: string[],
): Diagnostic[] {
  const expression = new RegExp(banned.pattern, banned.flags);
  return lines.flatMap((line, index) => {
    if (!expression.test(line)) return [];
    if (hasLineIgnoreAbove(lines, index + 1, markers)) return [];
    return [
      {
        file,
        line: index + 1,
        message: banned.message,
        expected: banned.expected,
        fix: banned.fix,
      },
    ];
  });
}

/**
 * Flags lines matching patterns the project has banned outright.
 *
 * @remarks The lowest-effort way to mint a project rule: most standards that
 * keep coming up in review are pattern-shaped — a forbidden import, a client
 * that must not be called directly, a TODO without a ticket — and deserve a
 * gate long before they deserve a plugin. Each pattern carries its own three
 * diagnostic fields, so the finding reads like any other rule's.
 */
export const bannedPatterns: FileRule<z.infer<typeof optionsSchema>> = {
  id: "banned-patterns",
  title: "Project-banned patterns stay out of the source",
  docs: "rules/banned-patterns.md",
  scope: "file",
  // Off until configured: with no patterns there is nothing to ban, and an
  // empty gate that runs anyway only pads the report.
  defaultSeverity: "off",
  defaultInclude: ["**/src/**/*.{ts,tsx,js,jsx,mjs,cjs}"],
  defaultExclude: ["**/*.test.*", "**/*.spec.*"],
  optionsSchema,

  checkFile({ file, bytes, options }): Diagnostic[] {
    if (bytes.includes(0)) return [];
    const lines = bytes.toString("utf8").split("\n");
    return options.patterns.flatMap((banned) =>
      matchesOf(file, lines, banned, options.ignoreMarkers),
    );
  },
};
