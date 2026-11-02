import { runRule } from "vibator/testing";
import { describe, expect, it } from "vitest";
import rule from "./markdown-accessible.ts";

/**
 * Runs the rule on one Markdown file and returns each finding's line and message.
 *
 * @param content - The Markdown text.
 * @returns The line and message of each finding.
 */
async function check(content: string) {
  const findings = await runRule(rule, { files: { "doc.md": content } });
  return findings.map(({ line, message }) => ({ line, message }));
}

describe("markdown-accessible", () => {
  it("reports an image without alt text", async () => {
    expect(await check("# Doc\n\n![](logo.svg)\n")).toEqual([
      { line: 3, message: "The image has no alt text." },
    ]);
  });

  it("reports an HTML image without an alt attribute", async () => {
    expect(await check('# Doc\n\n<img src="b.svg">\n')).toEqual([
      { line: 3, message: "The image has no alt text." },
    ]);
  });

  it('accepts alt="" on an HTML image that is decoration', async () => {
    expect(await check('# Doc\n\n<img src="a.svg" alt="">\n')).toEqual([]);
  });

  it("reports a heading that skips a level", async () => {
    expect(await check("# Doc\n\n### Details\n")).toEqual([
      { line: 3, message: "The heading jumps from level 1 to level 3." },
    ]);
  });

  it("reports link text that says nothing out of context", async () => {
    expect(await check("# Doc\n\nRead the guide [here](guide.md).\n")).toEqual([
      { line: 3, message: 'The link text "here" does not say where it goes.' },
    ]);
  });

  it("passes alt text, ordered headings, and descriptive links", async () => {
    expect(
      await check(
        '---\nname: doc\n---\n\n# Doc\n\n![The vibator mark](logo.svg)\n\n<img src="a.svg" alt="A">\n\n## Part\n\n### Detail\n\n## Next\n\nRead [the guide](guide.md).\n',
      ),
    ).toEqual([]);
  });
});
