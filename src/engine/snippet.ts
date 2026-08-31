/**
 * The source excerpt attached to a finding. A finding names a file and a line;
 * the excerpt saves the reader one trip into the file to see the offending
 * code. It is context for triage, not a substitute for opening the file.
 *
 * @packageDocumentation
 */

/**
 * Truncates one source line to something worth printing.
 *
 * @param line - The raw source line.
 * @param max - The longest line to print before clipping.
 * @returns The line, cut with an ellipsis when it exceeds the cap.
 */
function clip(line: string, max: number): string {
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

/**
 * Renders the lines around a finding as a gutter-numbered excerpt, marking the
 * finding's own lines.
 *
 * @param text - The file's contents.
 * @param line - The 1-based first line the finding points at.
 * @param endLine - The 1-based last line of the finding; defaults to `line`.
 * @param context - The number of lines shown on each side of the range.
 * @param maxLineLength - The longest line printed before it is clipped.
 * @param maxRange - The longest range excerpted. A finding that spans more
 * lines, or spans the whole file, points at no particular line, so it gets no
 * excerpt.
 * @returns The excerpt with the finding's lines marked, or undefined when the
 * start line falls outside the file or the range is too wide to excerpt.
 */
export function snippetAround(
  text: string,
  line: number,
  endLine: number = line,
  context: number = 2,
  maxLineLength: number = 200,
  maxRange: number = 20,
): string | undefined {
  const lines = text.split("\n");
  // A trailing newline leaves a phantom empty final line; showing it would
  // pad every end-of-file excerpt with an empty gutter row.
  if (lines.at(-1) === "") lines.pop();
  if (line < 1 || line > lines.length) return undefined;

  const last = Math.max(line, endLine);
  const span = last - line + 1;
  if (span > maxRange || (span > 1 && span >= lines.length)) return undefined;
  const first = Math.max(1, line - context);
  const past = Math.min(lines.length, last + context);
  const width = String(past).length;

  return lines
    .slice(first - 1, past)
    .map((content, index) => {
      const number = first + index;
      const marker = number >= line && number <= last ? ">" : " ";
      return `${marker} ${String(number).padStart(width)} | ${clip(content, maxLineLength)}`;
    })
    .join("\n");
}
