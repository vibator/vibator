import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createContext } from "../core/context.ts";
import { noDeadDocLinks } from "./no-dead-doc-links.ts";

/**
 * Builds a throwaway project containing a README and one real target.
 *
 * @returns The project root.
 */
function projectWithDocs(): string {
  const root = mkdtempSync(join(tmpdir(), "vibator-"));
  mkdirSync(join(root, "docs"));
  writeFileSync(join(root, "docs", "guide.md"), "# guide\n");
  return root;
}

/**
 * Runs the rule over a README with the given content.
 *
 * @param root - The project root.
 * @param content - The README's text.
 * @returns The diagnostics produced.
 */
function run(root: string, content: string) {
  const { context } = createContext(root);
  return noDeadDocLinks.checkFile({
    file: "README.md",
    bytes: Buffer.from(content),
    options: {},
    context,
  });
}

describe("no-dead-doc-links", () => {
  it("flags a relative link whose target is missing", () => {
    const found = run(projectWithDocs(), "See [gone](./docs/missing.md).\n");
    expect(found).toHaveLength(1);
    expect(found[0]?.line).toBe(1);
    expect(found[0]?.message).toContain("./docs/missing.md");
  });

  it("accepts a link whose target exists", () => {
    expect(run(projectWithDocs(), "See [guide](./docs/guide.md).\n")).toEqual(
      [],
    );
  });

  it("resolves relative to the linking file, not the root", () => {
    const root = projectWithDocs();
    writeFileSync(join(root, "docs", "next.md"), "[back](./guide.md)\n");
    const { context } = createContext(root);
    const found = noDeadDocLinks.checkFile({
      file: "docs/next.md",
      bytes: Buffer.from("[back](./guide.md)\n"),
      options: {},
      context,
    });
    expect(found).toEqual([]);
  });

  it("treats a leading slash as repository-relative", () => {
    expect(run(projectWithDocs(), "[guide](/docs/guide.md)\n")).toEqual([]);
  });

  it("ignores external, mailto and anchor-only links", () => {
    const external = [
      "[site](https://example.com/page)",
      "[mail](mailto:team@example.com)",
      "[below](#section)",
      "",
    ].join("\n");
    expect(run(projectWithDocs(), external)).toEqual([]);
  });

  it("strips anchors and queries before resolving", () => {
    expect(run(projectWithDocs(), "[guide](./docs/guide.md#intro)\n")).toEqual(
      [],
    );
  });

  it("checks image targets too", () => {
    const found = run(projectWithDocs(), "![shot](./docs/shot.png)\n");
    expect(found).toHaveLength(1);
  });

  it("leaves link syntax inside fenced code blocks alone", () => {
    const fenced = ["```md", "[example](./not-a-real-file.md)", "```", ""].join(
      "\n",
    );
    expect(run(projectWithDocs(), fenced)).toEqual([]);
  });

  it("leaves link syntax inside inline code alone", () => {
    expect(
      run(projectWithDocs(), "Write `[text](./missing.md)` to link.\n"),
    ).toEqual([]);
  });
});
