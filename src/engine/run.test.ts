import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { project } from "../namespace/project/index.ts";
import { defineRule, resetRules } from "../rules/define-rule.ts";
import { run } from "./run.ts";

describe("run", () => {
  let dir: string;

  beforeEach(() => {
    resetRules();
    dir = mkdtempSync(join(tmpdir(), "vibator-run-"));
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("collects findings with rule id and severity, relativizing paths", async () => {
    defineRule({
      id: "demo",
      title: "Demo",
      docs: "demo.md",
      check: () => ({
        diagnostics: [
          { file: join(dir, "src", "a.ts"), line: 2, message: "bad" },
        ],
      }),
    });
    const result = await run({ root: dir });
    expect(result.findings).toEqual([
      {
        ruleId: "demo",
        severity: "error",
        file: "src/a.ts",
        line: 2,
        message: "bad",
      },
    ]);
    expect(result.exitCode).toBe(1);
  });

  it("passes with only warnings", async () => {
    defineRule({
      id: "warned",
      title: "Warned",
      docs: "w.md",
      severity: "warn",
      check: () => ({ diagnostics: [{ message: "meh" }] }),
    });
    const result = await run({ root: dir });
    expect(result.findings[0]).toMatchObject({
      ruleId: "warned",
      severity: "warn",
    });
    expect(result.exitCode).toBe(0);
  });

  it("skips a rule turned off by config", async () => {
    writeFileSync(
      join(dir, ".vibator.json"),
      JSON.stringify({ rules: { silent: "off" } }),
    );
    defineRule({
      id: "silent",
      title: "Silent",
      docs: "s.md",
      check: () => ({ diagnostics: [{ message: "x" }] }),
    });
    const result = await run({ root: dir });
    expect(result.findings).toEqual([]);
    expect(result.exitCode).toBe(0);
  });

  it("runs only the named rules", async () => {
    defineRule({
      id: "a",
      title: "A",
      docs: "a.md",
      check: () => ({ diagnostics: [{ message: "A" }] }),
    });
    defineRule({
      id: "b",
      title: "B",
      docs: "b.md",
      check: () => ({ diagnostics: [{ message: "B" }] }),
    });
    const result = await run({ root: dir, only: ["a"] });
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(["a"]);
  });

  it("applies fixes and rechecks under write", async () => {
    let fixed = false;
    defineRule({
      id: "fixable",
      title: "Fixable",
      docs: "f.md",
      check: () => ({ diagnostics: fixed ? [] : [{ message: "fixme" }] }),
      fix: () => {
        fixed = true;
      },
    });
    expect((await run({ root: dir })).findings).toHaveLength(1);
    expect((await run({ root: dir, write: true })).findings).toHaveLength(0);
  });

  it("reports a crashed rule as an error", async () => {
    defineRule({
      id: "boom",
      title: "Boom",
      docs: "b.md",
      check: () => {
        throw new Error("kaboom");
      },
    });
    const result = await run({ root: dir });
    expect(result.exitCode).toBe(1);
    expect(result.findings[0]).toMatchObject({
      ruleId: "boom",
      severity: "error",
    });
    expect(result.findings[0]?.message).toContain("kaboom");
  });
});

describe("run scope", () => {
  const dir = mkdtempSync(join(tmpdir(), "vibator-run-git-"));
  const git = (...args: string[]): void => {
    execFileSync("git", args, { cwd: dir, stdio: "ignore" });
  };

  beforeAll(() => {
    resetRules();
    git("init");
    git("config", "user.email", "t@example.com");
    git("config", "user.name", "Test");
    writeFileSync(join(dir, "a.ts"), "a");
    git("add", "a.ts");
    git("commit", "-m", "init");
    writeFileSync(join(dir, "b.ts"), "b");
    git("add", "b.ts"); // staged, uncommitted
    defineRule({
      id: "per-file",
      title: "Per file",
      docs: "p.md",
      check: () => ({
        diagnostics: project.files.map((file) => ({
          file: file.path,
          message: "found",
        })),
      }),
    });
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("limits the run to staged files under --staged", async () => {
    const result = await run({ root: dir, staged: true });
    expect(result.findings.map((finding) => finding.file).sort()).toEqual([
      "b.ts",
    ]);
  });
});
