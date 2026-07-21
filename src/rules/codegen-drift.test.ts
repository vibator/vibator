import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createContext } from "../core/context.ts";
import { codegenDrift } from "./codegen-drift.ts";

/** A generator script that writes a fixed output file. */
const GENERATOR_SCRIPT =
  "require('fs').writeFileSync('gen.txt', 'generated\\n');\n";

/**
 * Builds a throwaway git repository with a generator and its committed output.
 *
 * @param committedOutput - The content committed as gen.txt.
 * @returns The repository root.
 */
function repositoryWith(committedOutput: string): string {
  const root = mkdtempSync(join(tmpdir(), "vibator-"));
  const git = (command: string) =>
    execSync(`git ${command}`, { cwd: root, stdio: "pipe" });
  writeFileSync(join(root, "gen.js"), GENERATOR_SCRIPT);
  writeFileSync(join(root, "gen.txt"), committedOutput);
  git("init -q -b main");
  git("config user.email test@example.com");
  git("config user.name test");
  git("add .");
  git("commit -qm initial");
  return root;
}

/**
 * Runs the rule with a single generator.
 *
 * @param root - The repository root.
 * @param command - The generator command to run.
 * @returns The diagnostics produced.
 */
async function run(root: string, command = "node gen.js") {
  const { context } = createContext(root);
  return await codegenDrift.check({
    files: [],
    options: codegenDrift.optionsSchema.parse({
      generators: [{ name: "fixture", command, paths: ["gen.txt"] }],
    }),
    context,
  });
}

describe("codegen-drift", () => {
  it("passes when the committed output matches the generator", async () => {
    const root = repositoryWith("generated\n");
    expect(await run(root)).toEqual([]);
  });

  it("flags drifted output and restores the committed content", async () => {
    const root = repositoryWith("stale\n");
    const found = await run(root);

    expect(found).toHaveLength(1);
    expect(found[0]?.file).toBe("gen.txt");
    expect(found[0]?.message).toContain("Out of date");
    expect(found[0]?.fix).toContain("node gen.js");
    // The rule reverts its own regeneration, leaving the tree as it found it.
    expect(readFileSync(join(root, "gen.txt"), "utf8")).toBe("stale\n");
  });

  it("refuses to check paths with uncommitted changes", async () => {
    const root = repositoryWith("generated\n");
    writeFileSync(join(root, "gen.txt"), "work in progress\n");

    const found = await run(root);
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain("Refusing");
    expect(readFileSync(join(root, "gen.txt"), "utf8")).toBe(
      "work in progress\n",
    );
  });

  it("reports a generator that fails instead of crashing the run", async () => {
    const root = repositoryWith("generated\n");
    const found = await run(root, 'node -e "process.exit(3)"');
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain('Generator "fixture" failed');
  });
});
