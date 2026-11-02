import { defineRule, vibator } from "vibator";
import { type MarkdownNode, parse, plainText, walk } from "./lib/markdown.ts";

/** One problem in a file, before it becomes a diagnostic. */
interface Problem {
  /** The node the problem is on. */
  node: MarkdownNode;
  /** What is wrong. */
  message: string;
  /** The next action. */
  fix: string;
}

/** Link texts that say nothing about where the link goes. */
const vagueLinkText = new Set([
  "here",
  "click here",
  "this",
  "link",
  "more",
  "read more",
]);

/** An HTML `<img>` tag without an `alt` attribute. `alt=""` marks decoration. */
const imgWithoutAlt = /<img\b(?![^>]*\balt=)[^>]*>/i;

/**
 * Finds the images without alt text, in Markdown and in HTML.
 *
 * @param nodes - Every node of a file.
 * @returns A problem for each image.
 */
function missingAlt(nodes: MarkdownNode[]): Problem[] {
  const problem = (node: MarkdownNode) => ({
    node,
    message: "The image has no alt text.",
    fix: 'Describe the image in its alt text, or use alt="" only on HTML images that are decoration.',
  });
  return [
    ...nodes.filter((node) => node.type === "image" && !node.alt?.trim()),
    ...nodes.filter(
      (node) => node.type === "html" && imgWithoutAlt.test(node.value ?? ""),
    ),
  ]
    .sort(
      (a, b) => (a.position?.start.line ?? 0) - (b.position?.start.line ?? 0),
    )
    .map(problem);
}

/**
 * Finds the headings that go more than one level deeper than the one before.
 *
 * @param nodes - Every node of a file.
 * @returns A problem for each skipped level.
 */
function skippedLevels(nodes: MarkdownNode[]): Problem[] {
  const headings = nodes.filter((node) => node.type === "heading");
  return headings.flatMap((node, index) => {
    const previous = headings[index - 1]?.depth ?? 0;
    const depth = node.depth ?? 1;
    if (index === 0 || depth <= previous + 1) return [];
    return [
      {
        node,
        message: `The heading jumps from level ${previous} to level ${depth}.`,
        fix: `Make it a level ${previous + 1} heading, or add the missing level.`,
      },
    ];
  });
}

/**
 * Finds the links whose text does not say where they go.
 *
 * @param nodes - Every node of a file.
 * @returns A problem for each vague link.
 */
function vagueLinks(nodes: MarkdownNode[]): Problem[] {
  return nodes
    .filter((node) => node.type === "link")
    .map((node) => ({ node, text: plainText(node).trim() }))
    .filter(({ text }) => vagueLinkText.has(text.toLowerCase()))
    .map(({ node, text }) => ({
      node,
      message: `The link text "${text}" does not say where it goes.`,
      fix: "Name the destination in the link text, such as the page title.",
    }));
}

export default defineRule({
  id: "markdown-accessible",
  title:
    "Markdown images have alt text, headings keep their order, and links say where they go",
  check: () =>
    vibator.project.files
      .match(["**/*.md", "!CHANGELOG.md"])
      .flatMap((file) => {
        const nodes = walk(parse(file.content));
        return [
          ...missingAlt(nodes),
          ...skippedLevels(nodes),
          ...vagueLinks(nodes),
        ].map(({ node, message, fix }) => ({
          file: file.path,
          line: node.position?.start.line,
          column: node.position?.start.column,
          message,
          expected:
            "A reader using a screen reader gets the same information as a sighted reader.",
          fix,
        }));
      }),
});
