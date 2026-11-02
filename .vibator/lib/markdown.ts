import { remark } from "remark";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import { settings } from "../../.remarkrc.mjs";

/** A node of a Markdown syntax tree, with the fields the rules read. */
export interface MarkdownNode {
  /** The node type, such as `heading` or `image`. */
  type: string;
  /** The children of a parent node. */
  children?: MarkdownNode[];
  /** The text of a text, code, or HTML node. */
  value?: string;
  /** The alt text of an image. */
  alt?: string | null;
  /** The level of a heading, from 1 to 6. */
  depth?: number;
  /** Where the node starts in the file. */
  position?: { start: { line: number; column: number } };
}

/** The remark processor, with the settings `npm run docs:format` writes with. */
export const processor = remark()
  .use(remarkFrontmatter)
  .use(remarkGfm)
  .data("settings", settings);

/**
 * Parses Markdown into its syntax tree.
 *
 * @param content - The Markdown text.
 * @returns The root node.
 */
export function parse(content: string): MarkdownNode {
  return processor.parse(content) as MarkdownNode;
}

/**
 * Lists a node and every node below it, in document order.
 *
 * @param node - The node to start from.
 * @returns The node and its descendants.
 */
export function walk(node: MarkdownNode): MarkdownNode[] {
  return [node, ...(node.children ?? []).flatMap(walk)];
}

/**
 * Joins the text of a node and its descendants.
 *
 * @param node - The node.
 * @returns The plain text.
 */
export function plainText(node: MarkdownNode): string {
  if (node.type === "text" || node.type === "inlineCode")
    return node.value ?? "";
  return (node.children ?? []).map(plainText).join("");
}
