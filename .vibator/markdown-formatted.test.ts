import { runRule } from "vibator/testing";
import { describe, expect, it } from "vitest";
import rule from "./markdown-formatted.ts";

describe("markdown-formatted", () => {
  it("reports the first line that differs from the remark format", async () => {
    const findings = await runRule(rule, {
      files: { "docs/guide.md": "# Guide\n\nText.\n\n* one\n* two\n" },
    });
    expect(findings).toEqual([
      expect.objectContaining({
        file: "docs/guide.md",
        line: 5,
        message: "The Markdown is not formatted.",
      }),
    ]);
  });

  it("passes a formatted file, frontmatter included", async () => {
    const findings = await runRule(rule, {
      files: {
        "SKILL.md": "---\nname: example\n---\n\n# Example\n\n- one\n- _two_\n",
      },
    });
    expect(findings).toEqual([]);
  });

  it("skips the changelog", async () => {
    const findings = await runRule(rule, {
      files: { "CHANGELOG.md": "# Changelog\n\n* entry\n" },
    });
    expect(findings).toEqual([]);
  });
});
