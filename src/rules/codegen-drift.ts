/**
 * Rule: generated files still match the source they are generated from.
 *
 * @packageDocumentation
 */
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { RuleContext } from "../core/context.ts";
import type { Diagnostic } from "../core/diagnostic.ts";
import type { ProjectRule } from "../core/rule.ts";

/** Options for {@link codegenDrift}. */
const optionsSchema = z.object({
  /** Generators to run, each with the paths it owns. */
  generators: z
    .array(
      z.object({
        /** Human-readable name, used in messages. */
        name: z.string().describe("Human-readable name, used in messages"),
        /** Shell command that regenerates the output. */
        command: z
          .string()
          .describe("Shell command that regenerates the output"),
        /** Working directory, relative to the project root. */
        cwd: z
          .string()
          .default(".")
          .describe("Working directory, relative to the project root"),
        /** Paths the generator writes, relative to the project root. */
        paths: z
          .array(z.string())
          .min(1)
          .describe("Paths the generator writes, relative to the project root"),
        /** How long to allow before treating the run as stuck. */
        timeoutMs: z
          .number()
          .int()
          .positive()
          .default(180_000)
          .describe("How long to allow before treating the run as stuck, ms"),
      }),
    )
    .min(1)
    .describe("Generators to run, each with the paths it owns"),
});

/** One configured generator. */
type Generator = z.infer<typeof optionsSchema>["generators"][number];

/**
 * The porcelain status of a set of paths.
 *
 * @remarks Deliberately not trimmed. Porcelain encodes status in the first two
 * columns, so a modified file reads `' M path'` with a leading space; trimming
 * would shift the first entry and take a character off its path.
 * @param context - Shared resources, for its git runner.
 * @param paths - Paths to inspect.
 * @returns One entry per changed path.
 */
function statusOf(context: RuleContext, paths: string[]): string[] {
  const output = execSync(
    `git status --porcelain -- ${paths.map((path) => JSON.stringify(path)).join(" ")}`,
    { cwd: context.root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return output.split("\n").filter((entry) => entry.length > 0);
}

/**
 * Undoes whatever a generation run wrote.
 *
 * @remarks Safe only because the paths were verified pristine first, so every
 * change present now was made by this rule. Untracked files are deleted and
 * tracked ones restored, both scoped to the generator's own paths.
 * @param context - Shared resources.
 * @param changes - The porcelain entries to undo.
 */
function revert(context: RuleContext, changes: string[]): void {
  const paths = changes.map((entry) => entry.slice(3));
  const untracked = changes
    .filter((entry) => entry.startsWith("??"))
    .map((entry) => entry.slice(3));

  untracked.forEach((path) => {
    rmSync(resolve(context.root, path), { force: true, recursive: true });
  });

  const tracked = paths.filter((path) => !untracked.includes(path));
  if (tracked.length > 0) context.git(["checkout", "--", ...tracked]);
}

/**
 * Runs one generator and reports whether its output had drifted.
 *
 * @param context - Shared resources.
 * @param generator - The generator to check.
 * @returns The findings for that generator.
 */
function checkGenerator(
  context: RuleContext,
  generator: Generator,
): Diagnostic[] {
  const preexisting = statusOf(context, generator.paths);
  if (preexisting.length > 0) return [refusal(generator)];

  const failure = regenerate(context, generator);
  if (failure) return [failure];

  const drift = statusOf(context, generator.paths);
  if (drift.length === 0) return [];

  revert(context, drift);
  return drift.map((entry) => ({
    file: entry.slice(3),
    message: `Out of date: regenerating "${generator.name}" changes this file`,
    expected: "Generated output committed alongside the source it derives from",
    fix: `Run \`${generator.command}\` and commit the result`,
  }));
}

/**
 * Explains why the rule will not judge output it did not find clean.
 *
 * @param generator - The generator whose paths are dirty.
 * @returns The refusal diagnostic.
 */
function refusal(generator: Generator): Diagnostic {
  return {
    message: `Refusing to check "${generator.name}": its output has uncommitted changes`,
    expected: "A clean working tree for generated paths",
    fix: `Commit or discard changes under ${generator.paths.join(", ")}, then re-run; this rule reverts what it generates and cannot tell your work from its own`,
  };
}

/**
 * Runs a generator.
 *
 * @param context - Shared resources.
 * @param generator - The generator to run.
 * @returns A diagnostic when the command itself failed, otherwise nothing.
 */
function regenerate(
  context: RuleContext,
  generator: Generator,
): Diagnostic | undefined {
  try {
    execSync(generator.command, {
      cwd: resolve(context.root, generator.cwd),
      stdio: ["ignore", "pipe", "pipe"],
      timeout: generator.timeoutMs,
    });
    return undefined;
  } catch (failure) {
    return {
      message: `Generator "${generator.name}" failed: ${generator.command}`,
      expected: "The generator runs cleanly",
      fix:
        failure instanceof Error
          ? failure.message.split("\n")[0]
          : String(failure),
    };
  }
}

/**
 * Flags generated output that no longer matches its source.
 *
 * @remarks The generic form of a check every repo with codegen needs: database
 * migrations against a schema, API clients against a spec, types against a
 * query. The failure is always the same shape: it compiles, it passes tests
 * against freshly generated output, and it breaks only where the committed
 * artifact is the one that runs.
 */
export const codegenDrift: ProjectRule<z.infer<typeof optionsSchema>> = {
  id: "codegen-drift",
  title: "Generated files match the source they derive from",
  docs: "rules/codegen-drift.md",
  scope: "project",
  // Off until configured: this rule cannot do anything without options, so
  // running it by default would fail a fresh project rather than help it.
  defaultSeverity: "off",
  defaultInclude: [],
  optionsSchema,

  check({ options, context }): Diagnostic[] {
    return options.generators.flatMap((generator, index) => {
      const found = checkGenerator(context, generator);
      context.progress(index + 1, options.generators.length);
      return found;
    });
  },
};
