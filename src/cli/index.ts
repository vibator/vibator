/**
 * The `vibator` command line: parse arguments, dispatch to the run command or a
 * subcommand.
 *
 * @packageDocumentation
 */
import { createRequire } from "node:module";
import { parseArgs } from "node:util";
import { run as runEngine } from "../engine/run.ts";
import { explain, init, list, skills } from "./commands/index.ts";
import { json, pretty, type Reporter, sarif } from "./reporters/index.ts";
import { spinner } from "./spinner.ts";

/**
 * The options the default command accepts.
 */
interface RunOptions {
  /** Runs each rule's `fix` and rechecks. */
  write?: boolean;
  /** Runs only these rule ids. */
  only?: string[];
  /** Loads configuration from a path instead of `.vibator.json`. */
  config?: string;
  /** Chooses the output format. Defaults to `pretty`. */
  reporter?: "pretty" | "json" | "sarif";
  /** Scopes the run to files staged for commit. */
  staged?: boolean;
  /** Scopes the run to uncommitted changes. */
  changed?: boolean;
  /** Scopes the run to changes since a ref. */
  since?: string;
}

/** The reporters selectable with `--reporter`. */
const reporters: Record<string, Reporter> = { pretty, json, sarif };

/**
 * Returns the vibator version from its package.json.
 *
 * @returns The version string.
 */
function version(): string {
  const manifest = createRequire(import.meta.url)("../../package.json") as {
    version: string;
  };
  return manifest.version;
}

/**
 * Runs the default command: run the engine, render with the chosen reporter,
 * and print.
 *
 * @param options - The run options.
 * @returns The process exit code.
 */
async function runCommand(options: RunOptions): Promise<number> {
  const result = await runEngine({
    config: options.config,
    only: options.only,
    write: options.write,
    staged: options.staged,
    changed: options.changed,
    since: options.since,
    onProgress: spinner(),
  });
  const reporter = reporters[options.reporter ?? "pretty"] ?? pretty;
  process.stdout.write(`${reporter(result.findings)}\n`);
  return result.exitCode;
}

/** Prints the command-line usage. */
function printUsage(): void {
  process.stdout.write(
    "Usage: vibator [options]\n" +
      "       vibator <list|explain|init|skills>\n\n" +
      "Options: --write --only <ids> --config <path>\n" +
      "         --reporter <pretty|json|sarif> --staged --changed --since <ref>\n" +
      "         --help --version\n",
  );
}

/**
 * Parses the arguments and dispatches to the run command or a subcommand.
 *
 * @param argv - The command-line arguments after the binary.
 * @returns The process exit code.
 */
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: argument parsing and dispatch read as one unit
export async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      write: { type: "boolean" },
      only: { type: "string" },
      config: { type: "string" },
      reporter: { type: "string" },
      staged: { type: "boolean" },
      changed: { type: "boolean" },
      since: { type: "string" },
      install: { type: "boolean" },
      help: { type: "boolean" },
      version: { type: "boolean" },
    },
  });

  if (values.help) {
    printUsage();
    return 0;
  }
  if (values.version) {
    process.stdout.write(`${version()}\n`);
    return 0;
  }

  switch (positionals[0]) {
    case "list":
      process.stdout.write(`${await list()}\n`);
      return 0;
    case "explain":
      process.stdout.write(`${await explain(positionals[1] ?? "")}\n`);
      return 0;
    case "init":
      process.stdout.write(`${init()}\n`);
      return 0;
    case "skills":
      process.stdout.write(`${skills(values.install ?? false)}\n`);
      return 0;
    case undefined:
      return runCommand({
        write: values.write,
        only: values.only?.split(","),
        config: values.config,
        reporter: values.reporter as RunOptions["reporter"],
        staged: values.staged,
        changed: values.changed,
        since: values.since,
      });
    default:
      process.stderr.write(`Unknown command: ${positionals[0]}\n`);
      return 1;
  }
}
