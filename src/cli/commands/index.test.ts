import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defineRule, resetRules } from "../../rules/define-rule.ts";
import { explain, init, list, skills } from "./index.ts";

let dir: string;

beforeEach(() => {
  resetRules();
  dir = mkdtempSync(join(tmpdir(), "vibator-cmd-"));
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("list", () => {
  it("lists rules with severity and title, sorted by id", async () => {
    defineRule({
      id: "b-rule",
      title: "B rule",
      docs: "b.md",
      severity: "warn",
      check: () => ({ diagnostics: [] }),
    });
    defineRule({
      id: "a-rule",
      title: "A rule",
      docs: "a.md",
      check: () => ({ diagnostics: [] }),
    });
    const output = await list(dir);
    expect(output).toContain("a-rule");
    expect(output).toContain("A rule");
    expect(output).toContain("warn");
    expect(output.indexOf("a-rule")).toBeLessThan(output.indexOf("b-rule"));
  });
});

describe("explain", () => {
  it("prints the guideline of a rule", async () => {
    writeFileSync(join(dir, "guide.md"), "# The guideline\n");
    defineRule({
      id: "documented",
      title: "Documented",
      docs: "guide.md",
      check: () => ({ diagnostics: [] }),
    });
    expect(await explain("documented", dir)).toContain("The guideline");
  });

  it("throws for an unknown rule", async () => {
    await expect(explain("nope", dir)).rejects.toThrow(/no such rule/i);
  });
});

describe("init", () => {
  it("writes a starter config", () => {
    expect(init(dir)).toContain(".vibator.json");
    const written = JSON.parse(
      readFileSync(join(dir, ".vibator.json"), "utf8"),
    );
    expect(written).toHaveProperty("rules");
  });

  it("refuses to overwrite an existing config", () => {
    init(dir);
    expect(() => init(dir)).toThrow(/already exists/i);
  });
});

describe("skills", () => {
  it("prints usage without --install", () => {
    expect(skills(false, dir)).toMatch(/--install/);
  });

  it("installs the bundled skills", () => {
    expect(skills(true, dir)).toMatch(/installed/i);
    expect(existsSync(join(dir, ".claude", "skills"))).toBe(true);
  });
});
