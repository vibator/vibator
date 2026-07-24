import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../core/config.ts";
import { BUILT_IN_RULES } from "../rules/index.ts";
import { docs, explain, list, skills } from "./inform.ts";

/** An empty, valid config. */
const EMPTY_CONFIG: Config = { plugins: [], rules: {}, guidelines: {} };

/**
 * Captures everything a command logs.
 *
 * @returns The captured lines and the spies to restore.
 */
function captureOutput(): { logged: string[]; failed: string[] } {
  const logged: string[] = [];
  const failed: string[] = [];
  vi.spyOn(console, "log").mockImplementation((line: string) => {
    logged.push(String(line));
  });
  vi.spyOn(console, "error").mockImplementation((line: string) => {
    failed.push(String(line));
  });
  return { logged, failed };
}

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe("docs", () => {
  it("prints a bundled document by topic", () => {
    const { logged } = captureOutput();
    docs("configuration");
    expect(logged.join("\n")).toContain("# Configuration");
  });

  it("lists the topics when none is given", () => {
    const { logged } = captureOutput();
    docs(undefined);
    expect(logged.join("\n")).toContain("writing-rules");
    expect(process.exitCode).toBeUndefined();
  });

  it("rejects an unknown topic with an exit code", () => {
    const { failed } = captureOutput();
    docs("nope");
    expect(failed.join("\n")).toContain("Unknown topic");
    expect(process.exitCode).toBe(1);
  });
});

describe("explain", () => {
  it("prints the guideline shipped with a rule", () => {
    const { logged } = captureOutput();
    explain("max-file-size", BUILT_IN_RULES, process.cwd(), EMPTY_CONFIG);
    expect(logged.join("\n")).toContain("No oversized files");
  });

  it("rejects an unknown rule and names the known ones", () => {
    const { failed } = captureOutput();
    explain("nope", BUILT_IN_RULES, process.cwd(), EMPTY_CONFIG);
    expect(failed.join("\n")).toContain("Unknown rule");
    expect(failed.join("\n")).toContain("max-file-size");
    expect(process.exitCode).toBe(1);
  });

  it("lists project guidelines mapped onto the rule", () => {
    const { logged } = captureOutput();
    const config: Config = {
      plugins: [],
      rules: {},
      guidelines: { "CLAUDE.md": ["max-file-size"] },
    };
    explain("max-file-size", BUILT_IN_RULES, process.cwd(), config);
    expect(logged.join("\n")).toContain("Project guidelines: CLAUDE.md");
  });
});

describe("list", () => {
  it("prints one line per rule with its default severity", () => {
    const { logged } = captureOutput();
    list(BUILT_IN_RULES);
    expect(logged).toHaveLength(BUILT_IN_RULES.length);
    expect(logged.join("\n")).toMatch(/max-file-size\s+error/);
  });
});

describe("skills", () => {
  it("lists the bundled skills without installing", () => {
    const { logged } = captureOutput();
    skills(mkdtempSync(join(tmpdir(), "vibator-")), false);
    expect(logged.join("\n")).toContain("writing-vibator-rules");
  });

  it("copies the skills into .claude/skills on install", () => {
    const root = mkdtempSync(join(tmpdir(), "vibator-"));
    captureOutput();
    skills(root, true);
    expect(
      existsSync(join(root, ".claude", "skills", "writing-vibator-rules")),
    ).toBe(true);
    expect(
      existsSync(join(root, ".claude", "skills", "configuring-vibator")),
    ).toBe(true);
  });
});
