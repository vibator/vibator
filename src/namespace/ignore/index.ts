/**
 * The `ignore` namespace: check ignore markers for a rule at line, node, or
 * file level.
 *
 * @remarks A marker reads `vibator-ignore <rule-id>: <reason>` on the line above
 * the finding, or `vibator-ignore-file <rule-id>: <reason>` anywhere in the
 * file. The reason is optional.
 *
 * @packageDocumentation
 */
import type { Node, SourceFile } from "typescript";
import type { File } from "../project/index.ts";
import { loadTypeScript } from "../typescript.ts";

/**
 * Whether any marker with the keyword in the text names the rule.
 *
 * @param text - The text to scan.
 * @param keyword - The marker keyword, such as `vibator-ignore`.
 * @param rule - The rule id the marker must name.
 * @returns Whether a matching marker names the rule.
 */
function markerNames(text: string, keyword: string, rule: string): boolean {
  const pattern = new RegExp(`${keyword}\\s+([^:\\n]*)`, "g");
  for (const match of text.matchAll(pattern)) {
    const ids = (match[1] ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.includes(rule)) return true;
  }
  return false;
}

/**
 * The text of a 0-based line, or undefined when out of range.
 *
 * @param sourceFile - The source file to read.
 * @param index - The 0-based line index.
 * @returns The line text, or undefined when out of range.
 */
function lineText(sourceFile: SourceFile, index: number): string | undefined {
  if (index < 0) return undefined;
  const starts = sourceFile.getLineStarts();
  if (index >= starts.length) return undefined;
  const start = starts[index] ?? 0;
  const end =
    index + 1 < starts.length ? starts[index + 1] : sourceFile.text.length;
  return sourceFile.text.slice(start, end);
}

/**
 * Whether a node is one an ignore marker can attach to.
 *
 * @param typescript - The TypeScript module.
 * @param node - The node to inspect.
 * @returns Whether the node is a scope a marker can attach to.
 */
function isScope(typescript: typeof import("typescript"), node: Node): boolean {
  return (
    typescript.isClassDeclaration(node) ||
    typescript.isFunctionDeclaration(node) ||
    typescript.isFunctionExpression(node) ||
    typescript.isArrowFunction(node) ||
    typescript.isMethodDeclaration(node) ||
    typescript.isInterfaceDeclaration(node) ||
    typescript.isEnumDeclaration(node) ||
    typescript.isModuleDeclaration(node)
  );
}

/**
 * Check whether an ignore marker silences a rule.
 */
export const ignore = {
  /**
   * Reports whether a marker on the line above names the rule.
   *
   * @param file - The file the line belongs to.
   * @param line - The 1-based line the finding sits on.
   * @param rule - The rule id the marker must name.
   * @returns Whether a marker on the line above names the rule.
   */
  line(file: File, line: number, rule: string): boolean {
    if (line < 2) return false;
    const above = file.content.split("\n")[line - 2];
    return above !== undefined && markerNames(above, "vibator-ignore", rule);
  },

  /**
   * Reports whether a marker above the node or an enclosing class, function,
   * method, interface, enum, or module names the rule.
   *
   * @param node - The node the finding sits on.
   * @param rule - The rule id the marker must name.
   * @returns Whether a marker covering the node names the rule.
   */
  node(node: Node, rule: string): boolean {
    const typescript = loadTypeScript();
    const sourceFile = node.getSourceFile();
    let current: Node | undefined = node;
    while (current) {
      if (current === node || isScope(typescript, current)) {
        const startLine = sourceFile.getLineAndCharacterOfPosition(
          current.getStart(),
        ).line;
        const above = lineText(sourceFile, startLine - 1);
        if (above !== undefined && markerNames(above, "vibator-ignore", rule)) {
          return true;
        }
      }
      current = current.parent;
    }
    return false;
  },

  /**
   * Reports whether a file-level marker names the rule.
   *
   * @param file - The file to inspect.
   * @param rule - The rule id the marker must name.
   * @returns Whether a file-level marker names the rule.
   */
  file(file: File, rule: string): boolean {
    return markerNames(file.content, "vibator-ignore-file", rule);
  },
};
