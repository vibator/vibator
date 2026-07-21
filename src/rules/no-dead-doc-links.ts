/**
 * Rule: relative links in Markdown point at files that exist.
 *
 * @packageDocumentation
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import type { Diagnostic } from "../core/diagnostic.ts";
import type { FileRule, FileRuleInput } from "../core/rule.ts";

/** Options for {@link noDeadDocLinks}. */
const optionsSchema = z.object({});

/**
 * A Markdown link or image whose target is inside the repository.
 *
 * @remarks External URLs, `mailto:` and pure `#anchor` links are someone
 * else's availability problem; this rule only judges what a commit in this
 * repository can break.
 */
const LINK = /!?\[[^\]]*\]\(<?([^)<>\s]+)>?(?:\s+"[^"]*")?\)/g;

/**
 * Blanks the regions of a Markdown document where a link is not a link.
 *
 * @remarks Fenced code blocks and inline code spans routinely show link syntax
 * as an example. Blanking rather than removing keeps every remaining character
 * on its original line, so reported line numbers stay true.
 * @param text - The Markdown source.
 * @returns The text with code regions replaced by spaces.
 */
function blankCodeRegions(text: string): string {
  const preserveNewlines = (region: string): string =>
    region.replace(/[^\n]/g, " ");
  return text
    .replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, preserveNewlines)
    .replace(/`[^`\n]*`/g, preserveNewlines);
}

/**
 * Whether a link target is out of this rule's jurisdiction.
 *
 * @param target - The raw link target.
 * @returns `true` for external, protocol or anchor-only targets.
 */
function isExternal(target: string): boolean {
  return /^[a-z][a-z+.-]*:/i.test(target) || target.startsWith("#");
}

/**
 * Resolves a link target against the file it appears in.
 *
 * @param context - Shared resources, for the project root.
 * @param file - The Markdown file holding the link.
 * @param target - The target with anchor and query stripped.
 * @returns The absolute path the link points at.
 */
function resolveTarget(
  context: FileRuleInput<unknown>["context"],
  file: string,
  target: string,
): string {
  return target.startsWith("/")
    ? resolve(context.root, target.slice(1))
    : resolve(context.root, dirname(file), target);
}

/**
 * Flags relative Markdown links whose target file does not exist.
 *
 * @remarks Documentation is the part of a change nothing type-checks. A moved
 * or renamed file updates every import or the build fails — but the README
 * that pointed at it keeps pointing at nothing, and the reader who follows
 * the link months later is the first to find out.
 */
export const noDeadDocLinks: FileRule<z.infer<typeof optionsSchema>> = {
  id: "no-dead-doc-links",
  title: "Relative links in Markdown point at files that exist",
  docs: "rules/no-dead-doc-links.md",
  scope: "file",
  defaultSeverity: "error",
  defaultInclude: ["**/*.md"],
  optionsSchema,

  checkFile({ file, bytes, context }): Diagnostic[] {
    const lines = blankCodeRegions(bytes.toString("utf8")).split("\n");

    return lines.flatMap((line, index) =>
      [...line.matchAll(LINK)].flatMap((match) =>
        judgeTarget(context, file, index + 1, match[1] ?? ""),
      ),
    );
  },
};

/**
 * Judges one link target.
 *
 * @param context - Shared resources, for the project root.
 * @param file - The Markdown file holding the link.
 * @param line - The 1-based line the link appears on.
 * @param target - The raw link target.
 * @returns A diagnostic when the target is a missing repository file.
 */
function judgeTarget(
  context: FileRuleInput<unknown>["context"],
  file: string,
  line: number,
  target: string,
): Diagnostic[] {
  if (isExternal(target)) return [];

  const path = (target.split(/[#?]/)[0] ?? "").trim();
  if (path === "" || existsSync(resolveTarget(context, file, path))) return [];

  return [
    {
      file,
      line,
      message: `Link target does not exist: ${target}`,
      expected: "Every relative link resolves to a file in the repository",
      fix: `Fix the path or remove the link — ${path} is not there`,
    },
  ];
}
