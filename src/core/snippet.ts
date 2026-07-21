/**
 * The source excerpt attached to a finding.
 *
 * @remarks A finding names a file and a line; the excerpt saves the reader —
 * human or agent — one round trip into the file just to see what the finding
 * is talking about. It is context for triage, not a substitute for opening
 * the file to fix it.
 *
 * @packageDocumentation
 */

/** Lines shown on each side of the reported one. */
const CONTEXT_LINES = 2;

/** Longest rendered line; anything past this is minified output, not reading. */
const MAX_LINE_LENGTH = 200;

/**
 * Truncates one source line to something worth printing.
 *
 * @param line - The raw source line.
 * @returns The line, cut with an ellipsis when it exceeds the cap.
 */
function clip(line: string): string {
  return line.length > MAX_LINE_LENGTH
    ? `${line.slice(0, MAX_LINE_LENGTH)}…`
    : line;
}

/**
 * Renders the lines around one finding as a gutter-numbered excerpt.
 *
 * @param text - The file's contents.
 * @param line - The 1-based line the finding points at.
 * @returns The excerpt with the reported line marked, or `undefined` when the
 * line falls outside the file.
 */
export function snippetAround(text: string, line: number): string | undefined {
  const lines = text.split("\n");
  // A trailing newline leaves a phantom empty final line; showing it would
  // pad every end-of-file excerpt with an empty gutter row.
  if (lines.at(-1) === "") lines.pop();
  if (line < 1 || line > lines.length) return undefined;

  const first = Math.max(1, line - CONTEXT_LINES);
  const last = Math.min(lines.length, line + CONTEXT_LINES);
  const width = String(last).length;

  return lines
    .slice(first - 1, last)
    .map((content, index) => {
      const number = first + index;
      const marker = number === line ? ">" : " ";
      return `${marker} ${String(number).padStart(width)} | ${clip(content)}`;
    })
    .join("\n");
}
