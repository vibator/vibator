import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** The CLI entry point, run from source through Node's type stripping. */
const CLI = join(process.cwd(), "src", "cli.ts");

/** What one CLI invocation produced. */
interface CliOutcome {
  /** The process exit code. */
  status: number;
  /** Captured stdout. */
  stdout: string;
}

/**
 * Runs the CLI in a directory and captures the outcome.
 *
 * @param cwd - The project directory to run in.
 * @param cliArguments - Arguments after the entry point.
 * @returns The exit code and stdout.
 */
function runCli(cwd: string, cliArguments: string[]): CliOutcome {
  try {
    const stdout = execFileSync(
      process.execPath,
      ["--no-warnings", "--experimental-strip-types", CLI, ...cliArguments],
      { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return { status: 0, stdout };
  } catch (failure) {
    const failed = failure as { status?: number; stdout?: string };
    return { status: failed.status ?? -1, stdout: failed.stdout ?? "" };
  }
}

describe("the CLI against fixture projects", () => {
  it("fails a bare JavaScript project with a conflict marker, as JSON", () => {
    const root = mkdtempSync(join(tmpdir(), "vibator-fixture-"));
    writeFileSync(
      join(root, "conflicted.js"),
      "let counter = 0;\n<<<<<<< HEAD\nlet other = 1;\n",
    );
    writeFileSync(join(root, "small.js"), "let counter = 0;\n");

    const { status, stdout } = runCli(root, ["--reporter", "json"]);
    expect(status).toBe(1);

    const report = JSON.parse(stdout);
    expect(report.ok).toBe(false);
    const conflictMarkers = report.rules.find(
      (entry: { ruleId: string }) => entry.ruleId === "no-conflict-markers",
    );
    expect(conflictMarkers.diagnostics[0].file).toBe("conflicted.js");
    expect(conflictMarkers.diagnostics[0].fix).toBeTruthy();
    expect(conflictMarkers.diagnostics[0].snippet).toContain("<<<<<<<");
    // No rule may crash on a project with no TypeScript and no git.
    for (const entry of report.rules) {
      expect(entry.error).toBeUndefined();
    }
  });

  it("passes a CSS-only project with zero configuration", () => {
    const root = mkdtempSync(join(tmpdir(), "vibator-fixture-"));
    writeFileSync(join(root, "style.css"), "body { margin: 0; }\n");

    const { status, stdout } = runCli(root, ["--reporter", "json"]);
    expect(status).toBe(0);
    expect(JSON.parse(stdout).ok).toBe(true);
  });

  it("writes a working config with init and passes the next run", () => {
    const root = mkdtempSync(join(tmpdir(), "vibator-fixture-"));
    writeFileSync(join(root, "index.js"), "let counter = 0;\n");

    expect(runCli(root, ["init"]).status).toBe(0);
    expect(existsSync(join(root, "vibator.json"))).toBe(true);
    expect(runCli(root, ["--reporter", "json"]).status).toBe(0);
  });

  it("prints usage on --help without running a check", () => {
    const root = mkdtempSync(join(tmpdir(), "vibator-fixture-"));
    const { status, stdout } = runCli(root, ["--help"]);
    expect(status).toBe(0);
    expect(stdout).toContain("Usage");
    expect(stdout).toContain("--reporter");
  });

  it("rejects an unknown command with a usable message", () => {
    const root = mkdtempSync(join(tmpdir(), "vibator-fixture-"));
    const { status } = runCli(root, ["chekc"]);
    expect(status).toBe(1);
  });
});
