/**
 * Command line parsing, and the usage text behind `--help`.
 *
 * @packageDocumentation
 */
import { parseArgs } from "node:util";

/** The subcommands this binary understands. */
const COMMANDS = [
  "check",
  "list",
  "explain",
  "docs",
  "init",
  "skills",
] as const;

/** One of the recognised subcommands. */
type Command = (typeof COMMANDS)[number];

/** Parsed command line arguments. */
export interface CliArguments {
  /** The subcommand, defaulting to `check`. */
  command: Command;
  /** Positional argument, such as the rule id for `explain`. */
  target?: string;
  /** Explicit config path, when `--config` was passed. */
  config?: string;
  /** Only run these rule ids, when `--only` was passed. */
  only?: string[];
  /** Which reporter to use. */
  reporter: "pretty" | "json";
  /** Restrict the run to files staged for the next commit. */
  staged: boolean;
  /** Restrict the run to uncommitted changes. */
  changed: boolean;
  /** Also include everything changed since this ref, such as `origin/main`. */
  since?: string;
  /** Whether `skills` should copy rather than list. */
  install: boolean;
  /** Print usage and exit. */
  help: boolean;
  /** Print the version and exit. */
  version: boolean;
}

/** What `vibator --help` prints. */
export const USAGE = `vibator, a quality gate framework for coding agents

Usage
  vibator [check] [flags]      run every enabled rule
  vibator list                 every rule, its default severity and title
  vibator explain <rule>       the guideline in force for a rule
  vibator docs [topic]         print a bundled document (writing-rules, configuration, rules)
  vibator init                 write a starter vibator.json
  vibator skills [--install]   list bundled agent skills, or copy them into .claude/skills/

Flags
  --config <path>       explicit config file (default: vibator.json, .vibator.json)
  --only <ids>          comma-separated rule ids to run
  --reporter <name>     pretty (default) or json
  --staged              judge only files staged for the next commit
  --changed             judge only uncommitted changes (staged, unstaged, untracked)
  --since <ref>         judge only files changed since <ref>, plus uncommitted work
  -h, --help            this text
  -v, --version         the installed version

Exit code is 1 on any error-severity finding, or when a rule crashes.
Warnings alone exit 0.`;

/** The flags `parseArgs` accepts, with their types and defaults. */
const FLAG_DEFINITIONS = {
  config: { type: "string" },
  only: { type: "string" },
  reporter: { type: "string" },
  staged: { type: "boolean", default: false },
  changed: { type: "boolean", default: false },
  since: { type: "string" },
  install: { type: "boolean", default: false },
  help: { type: "boolean", short: "h", default: false },
  version: { type: "boolean", short: "v", default: false },
} as const;

/**
 * Validates the reporter flag.
 *
 * @param reporter - The raw flag value, if any.
 * @returns The reporter to use.
 * @throws When the value names no known reporter.
 */
function reporterOf(reporter: string | undefined): "pretty" | "json" {
  if (reporter === undefined || reporter === "pretty") return "pretty";
  if (reporter === "json") return "json";
  throw new Error(`Unknown reporter: ${reporter} (pretty or json)`);
}

/**
 * Parses the command line.
 *
 * @param argv - Arguments after the node binary and script path.
 * @returns The parsed arguments.
 * @throws When a flag is unknown, a value is missing, or the subcommand is not
 * one of ours; a typo that silently ran the default would check the wrong
 * thing and look intentional.
 */
export function parseArguments(argv: string[]): CliArguments {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: FLAG_DEFINITIONS,
  });

  const [first, second] = positionals;
  const command = commandOf(first, values.help || values.version);

  return {
    command,
    target: first === command ? second : undefined,
    config: values.config,
    only: values.only ? values.only.split(",") : undefined,
    reporter: reporterOf(values.reporter),
    staged: values.staged,
    changed: values.changed,
    since: values.since,
    install: values.install,
    help: values.help,
    version: values.version,
  };
}

/**
 * Maps the first positional onto a subcommand.
 *
 * @param first - The first positional argument, if any.
 * @param informational - Whether `--help` or `--version` short-circuits anyway.
 * @returns The subcommand.
 * @throws When the positional names no known command.
 */
function commandOf(first: string | undefined, informational: boolean): Command {
  if (first === undefined) return "check";
  if ((COMMANDS as readonly string[]).includes(first)) return first as Command;
  if (informational) return "check";
  throw new Error(
    `Unknown command: ${first}\nCommands: ${COMMANDS.join(", ")} (see --help)`,
  );
}
