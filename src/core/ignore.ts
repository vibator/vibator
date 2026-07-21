/**
 * The text-level escape hatch shared by rules that scan lines rather than
 * syntax trees.
 *
 * @remarks The AST rules carry their own node-based variant in `ts-support`;
 * this one works on plain lines so a rule over JSON, Markdown, YAML or shell
 * can honour the same convention: a marker on the line above, with a mandatory
 * reason. An unexplained exemption is the drift the rules exist to stop.
 *
 * @packageDocumentation
 */

/**
 * Whether the line above an offending one opts it out with a reasoned marker.
 *
 * @remarks Accepts `//`, `#` and `<!--` comment leaders, so the same marker
 * works across source, config and Markdown. The bare marker never matches —
 * only one followed by a reason.
 * @param lines - The file's lines, in order.
 * @param line - The 1-based line the finding points at.
 * @param markers - The accepted marker words, such as `vibator-ignore`.
 * @returns `true` when the preceding line carries a reasoned marker.
 */
export function hasLineIgnoreAbove(
  lines: string[],
  line: number,
  markers: string[],
): boolean {
  if (line < 2) return false;
  const previous = lines[line - 2] ?? "";
  return markers.some((marker) =>
    new RegExp(`(?://|#|<!--)\\s*${marker}:\\s*\\S`).test(previous),
  );
}
