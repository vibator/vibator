#!/usr/bin/env node
/**
 * Command line entry point.
 *
 * @packageDocumentation
 */
import { type CliArguments, parseArguments, USAGE } from "./cli/arguments.ts";
import { docs, explain, list, skills } from "./cli/inform.ts";
import { init } from "./cli/init.ts";
import { type Config, loadConfig, resolveRules } from "./core/config.ts";
import { changedFiles, stagedFiles } from "./core/discovery.ts";
import { run } from "./core/engine.ts";
import { packageVersion } from "./core/package-root.ts";
import { loadPlugins, mergeRules } from "./core/plugins.ts";
import type { AnyRule } from "./core/rule.ts";
import { jsonReporter } from "./reporters/json.ts";
import { prettyReporter } from "./reporters/pretty.ts";
import { BUILT_IN_RULES } from "./rules/index.ts";

/**
 * Silences Node's experimental-feature notices.
 *
 * @remarks File discovery uses `fs.globSync`, which Node still marks
 * experimental. The notice is about Node's API surface, not about anything the
 * user did, and printing it on every run trains people to ignore our output.
 */
function silenceExperimentalWarnings(): void {
  process.removeAllListeners("warning");
  process.on("warning", (warning) => {
    if (warning.name !== "ExperimentalWarning") console.warn(warning);
  });
}

/**
 * The file scope a change-restricted run is limited to, if any.
 *
 * @remarks The flags compose by union: `--staged --since main` judges what
 * this commit records plus what the branch already changed.
 * @param args - The parsed arguments.
 * @param root - Absolute project root.
 * @returns The restriction, or `undefined` for a full run.
 */
function restrictionOf(
  args: CliArguments,
  root: string,
): Set<string> | undefined {
  if (!args.staged && !args.changed && !args.since) return undefined;

  const scoped = new Set<string>(args.staged ? stagedFiles(root) : []);
  if (args.changed || args.since) {
    changedFiles(root, args.since).forEach((file) => {
      scoped.add(file);
    });
  }
  return scoped;
}

/**
 * Runs the check command.
 *
 * @param args - The parsed arguments.
 * @param root - Absolute project root.
 * @param config - The loaded config.
 * @param rules - Every registered rule.
 * @returns Nothing; exits non-zero when any error-severity finding is reported.
 */
async function check(
  args: CliArguments,
  root: string,
  config: Config,
  rules: AnyRule[],
): Promise<void> {
  // Filtered before resolution: a rule the caller excluded should not be able
  // to fail the run by having invalid options.
  const selected = rules.filter(
    (rule) => !args.only || args.only.includes(rule.id),
  );
  const resolved = resolveRules(config, selected, rules);

  const reporter = args.reporter === "json" ? jsonReporter() : prettyReporter();
  const result = await run(root, resolved, reporter, {
    restrict: restrictionOf(args, root),
  });
  if (result.errors > 0) process.exitCode = 1;
}

/**
 * Routes a parsed command to its implementation.
 *
 * @param args - The parsed arguments.
 * @param root - Absolute project root.
 * @returns Nothing; each command sets the exit code as it sees fit.
 */
async function dispatch(args: CliArguments, root: string): Promise<void> {
  const config = loadConfig(root, args.config);
  const rules = mergeRules(
    BUILT_IN_RULES,
    await loadPlugins(root, config.plugins),
  );

  if (args.command === "explain")
    return explain(args.target, rules, root, config);
  if (args.command === "list") return list(rules);
  if (args.command === "docs") return docs(args.target);
  if (args.command === "init") return init(root, rules);
  if (args.command === "skills") return skills(root, args.install);
  await check(args, root, config, rules);
}

/**
 * Parses the command line and runs the requested command.
 *
 * @returns Nothing; sets the process exit code.
 */
async function main(): Promise<void> {
  silenceExperimentalWarnings();

  try {
    const args = parseArguments(process.argv.slice(2));
    if (args.help) return console.log(USAGE);
    if (args.version) return console.log(packageVersion());
    await dispatch(args, process.cwd());
  } catch (failure) {
    console.error(failure instanceof Error ? failure.message : String(failure));
    process.exitCode = 1;
  }
}

await main();
