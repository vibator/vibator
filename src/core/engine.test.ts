import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { ResolvedRule } from "./config.ts";
import type { Diagnostic } from "./diagnostic.ts";
import { type RunEvent, run } from "./engine.ts";
import type { AnyRule } from "./rule.ts";

/**
 * Builds a throwaway project with two source files.
 *
 * @returns The absolute project root.
 */
function projectWithFiles(): string {
  const root = mkdtempSync(join(tmpdir(), "vibator-"));
  writeFileSync(join(root, "a.ts"), "const one = 1;\nconst two = 2;\n");
  writeFileSync(join(root, "b.ts"), "const three = 3;\n");
  return root;
}

/**
 * Wraps a file rule in resolved settings.
 *
 * @param rule - The rule to resolve.
 * @param overrides - Fields overriding the defaults used here.
 * @returns The resolved rule.
 */
function resolved(
  rule: AnyRule,
  overrides: Partial<ResolvedRule> = {},
): ResolvedRule {
  return {
    rule,
    severity: "error",
    include: ["**/*.ts"],
    exclude: [],
    options: {},
    docs: rule.docs,
    docsOverridden: false,
    guidelines: [],
    ...overrides,
  };
}

/**
 * A file rule reporting one finding per file, on line 1.
 *
 * @param id - The rule id to report under.
 * @returns The rule.
 */
function reportingRule(id: string): AnyRule {
  return {
    id,
    title: "Reports every file",
    docs: "rules/max-file-size.md",
    scope: "file",
    defaultSeverity: "error",
    defaultInclude: ["**/*.ts"],
    optionsSchema: z.object({}),
    checkFile: ({ file }): Diagnostic[] => [
      { file, line: 1, message: "reported", expected: "not", fix: "remove" },
    ],
  };
}

describe("run", () => {
  it("emits the event sequence a reporter draws from", async () => {
    const kinds: string[] = [];
    await run(projectWithFiles(), [resolved(reportingRule("seq"))], (event) => {
      kinds.push(event.kind);
    });

    expect(kinds[0]).toBe("run:start");
    expect(kinds[1]).toBe("rule:start");
    expect(kinds[2]).toBe("rule:discovered");
    expect(kinds).toContain("rule:progress");
    expect(kinds.at(-2)).toBe("rule:done");
    expect(kinds.at(-1)).toBe("run:done");
  });

  it("attaches severity, snippet and resolved docs to findings", async () => {
    const root = projectWithFiles();
    const events: RunEvent[] = [];
    const outcome = await run(
      root,
      [resolved(reportingRule("attach"))],
      (event) => events.push(event),
    );

    const [finding] = outcome.rules[0]?.diagnostics ?? [];
    expect(finding?.severity).toBe("error");
    expect(finding?.snippet).toContain("> 1 | const one = 1;");
    // The rule points at a document this package ships, so the reference
    // resolves to an absolute path a consumer can open.
    expect(finding?.docs[0]?.path).toBe("rules/max-file-size.md");
    expect(finding?.docs[0]?.absolutePath).toMatch(/max-file-size\.md$/);
    expect(outcome.errors).toBe(2);
    expect(outcome.warnings).toBe(0);
  });

  it("resolves overridden docs and mapped guidelines against the project", async () => {
    const root = projectWithFiles();
    mkdirSync(join(root, "docs"));
    writeFileSync(join(root, "docs", "style.md"), "# style\n");

    const outcome = await run(
      root,
      [
        resolved(reportingRule("override"), {
          docs: "docs/style.md",
          docsOverridden: true,
          guidelines: ["docs/style.md"],
        }),
      ],
      () => {},
    );

    const docs = outcome.rules[0]?.diagnostics[0]?.docs ?? [];
    expect(docs).toHaveLength(2);
    expect(docs[0]?.absolutePath).toBe(join(root, "docs", "style.md"));
    expect(docs[1]?.absolutePath).toBe(join(root, "docs", "style.md"));
  });

  it("keeps a missing guideline as a bare path", async () => {
    const outcome = await run(
      projectWithFiles(),
      [
        resolved(reportingRule("missing-doc"), {
          docs: "docs/not-written-yet.md",
          docsOverridden: true,
        }),
      ],
      () => {},
    );

    const [reference] = outcome.rules[0]?.diagnostics[0]?.docs ?? [];
    expect(reference?.path).toBe("docs/not-written-yet.md");
    expect(reference?.absolutePath).toBeUndefined();
  });

  it("counts warn-severity findings as warnings, not errors", async () => {
    const outcome = await run(
      projectWithFiles(),
      [resolved(reportingRule("warned"), { severity: "warn" })],
      () => {},
    );

    expect(outcome.errors).toBe(0);
    expect(outcome.warnings).toBe(2);
  });

  it("turns a crashing rule into a result instead of taking the run down", async () => {
    const crashing: AnyRule = {
      ...reportingRule("crashes"),
      scope: "project",
      check: () => {
        throw new Error("boom");
      },
    } as AnyRule;

    const outcome = await run(
      projectWithFiles(),
      [resolved(crashing), resolved(reportingRule("still-runs"))],
      () => {},
    );

    expect(outcome.rules[0]?.error).toBe("boom");
    expect(outcome.rules[1]?.diagnostics).toHaveLength(2);
    // The crash itself counts as one error on top of the findings.
    expect(outcome.errors).toBe(3);
  });

  it("restricts the run to the given file set", async () => {
    const outcome = await run(
      projectWithFiles(),
      [resolved(reportingRule("restricted"))],
      () => {},
      { restrict: new Set(["a.ts"]) },
    );

    expect(outcome.rules[0]?.files).toBe(1);
    expect(outcome.rules[0]?.diagnostics[0]?.file).toBe("a.ts");
  });

  it("hands project rules the whole file list at once", async () => {
    let received: string[] = [];
    const projectRule: AnyRule = {
      ...reportingRule("project-scope"),
      scope: "project",
      check: ({ files }: { files: string[] }): Diagnostic[] => {
        received = files;
        return [{ message: "project-wide" }];
      },
    } as AnyRule;

    const outcome = await run(
      projectWithFiles(),
      [resolved(projectRule)],
      () => {},
    );

    expect(received.sort()).toEqual(["a.ts", "b.ts"]);
    // A finding without a file gets no snippet.
    expect(outcome.rules[0]?.diagnostics[0]?.snippet).toBeUndefined();
  });
});
