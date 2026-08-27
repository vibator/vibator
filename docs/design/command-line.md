# Command line

This document is the reference of the `vibator` command line: the command that
runs the rules, its options, and the subcommands, as they are provided by the
base vibator framework.

## Reference

- [vibator](#vibator) — Run every enabled rule.
- [Reporters](#reporters) — The output formats.
- [Subcommands](#subcommands) — The informational and setup commands.
- [Exit codes](#exit-codes) — What the process returns.

---

## vibator

The default command runs every enabled rule.

| Flag                               | Description                                      |
|------------------------------------|--------------------------------------------------|
| --write                            | Runs each rule's `fix` and rechecks.             |
| --only \<ids\>                     | Runs only the comma-separated rule ids.          |
| --config \<path\>                  | Loads configuration from a path.                 |
| --reporter \<pretty\|json\|sarif\> | Chooses the output format. Defaults to `pretty`. |
| --staged                           | Scopes the run to files staged for commit.       |
| --changed                          | Scopes the run to uncommitted changes.           |
| --since \<ref\>                    | Scopes the run to changes since a ref.           |
| --help                             | Prints usage.                                    |
| --version                          | Prints the version.                              |

## Reporters

The output formats the `--reporter` flag selects.

| Format | Description                                                                                                       |
|--------|-------------------------------------------------------------------------------------------------------------------|
| pretty | A readable, colored report for a terminal[^1]. The default.                                                       |
| json   | The machine-readable format, for a direct integration.                                                            |
| sarif  | The [SARIF](https://sarifweb.azurewebsites.net) interchange format, for tools such as trunk.io and code scanning. |

[^1]: Set the `NO_COLOR` environment variable to disable colors, or `FORCE_COLOR`
to enable them when standard output is not a terminal.

## Subcommands

| Command          | Description                                    |
|------------------|------------------------------------------------|
| list             | Prints every rule with its severity and title. |
| explain \<rule\> | Prints the guideline for a rule.               |
| init             | Writes a starter `.vibator.json`.              |
| skills --install | Copies the bundled skills into the project.    |

## Exit codes

| Code | Meaning                                            |
|------|----------------------------------------------------|
| 0    | Findings stay at warning severity or below.        |
| 1    | An error-severity finding, or a rule that crashed. |
