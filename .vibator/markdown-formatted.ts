import { defineRule, vibator } from "vibator";
import { processor } from "./lib/markdown.ts";

/**
 * Formats Markdown the way `npm run docs:format` does.
 *
 * @param content - The Markdown text.
 * @returns The formatted text.
 */
function format(content: string): string {
  return String(processor.processSync(content));
}

/**
 * Finds the first line where two texts differ.
 *
 * @param actual - The text as it is.
 * @param formatted - The text as it should be.
 * @returns The 1-based line number.
 */
function firstDifference(actual: string, formatted: string): number {
  const lines = actual.split("\n");
  const expected = formatted.split("\n");
  const index = lines.findIndex((line, i) => line !== expected[i]);
  return (index === -1 ? lines.length : index) + 1;
}

export default defineRule({
  id: "markdown-formatted",
  title: "Markdown files match the remark format",
  check: () =>
    vibator.project.files
      .match(["**/*.md", "!CHANGELOG.md"])
      .flatMap((file) => {
        const formatted = format(file.content);
        if (formatted === file.content) return [];
        return [
          {
            file: file.path,
            line: firstDifference(file.content, formatted),
            message: "The Markdown is not formatted.",
            expected: "The file matches remark's output with .remarkrc.mjs.",
            fix: "Run npx vibator --write, or npm run docs:format.",
          },
        ];
      }),
  fix: (_options, report) => {
    for (const { file } of report.diagnostics) {
      if (file === undefined) continue;
      vibator.project.write(
        file,
        format(vibator.project.files.get(file).content),
      );
    }
  },
});
