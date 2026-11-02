# What is vibator?

vibator is a small framework for project rules over JavaScript and TypeScript
projects. It ships no rules. You write a rule as one file in `.vibator/`, and
`npx vibator` runs it, reports its findings, and applies its fix on request.

## The problem it solves

Coding agents check project standards with one-off scripts. Ask an agent to make
sure every locale file has the same keys, and it writes
`scripts/check-locales.mjs` and adds an npm script to run it.

Repeat that for each standard and the project collects a folder of scripts. Each
one has its own file discovery, its own output format, and its own exit code.

A vibator rule replaces one of those scripts. The rule keeps the check.
vibator provides the file discovery, the parsing helpers, the report, and the
command line.

## How it works

- A rule reads the project through the `vibator` namespace and returns its
  findings.
- The namespace covers files, text, JSON, TypeScript, `package.json`, git, and
  the shell.
- A rule decides which files it reads. It sees every file at once, so it can
  compare files with each other.
- Each finding has a `message` (what is wrong), an `expected` value (the
  standard), and a `fix` (the next action).
- A rule can implement `fix`. Under `--write`, vibator runs `check`, then `fix`,
  then `check` again.
- Each rule has a severity: `error`, `warn`, or `off`.
- The output is a terminal report, JSON, or SARIF.

## What a rule is for

A rule covers a check that applies to one project only. For example:

- Every locale file has the keys of the default locale.
- Every environment variable the code reads is listed in `.env.example`.
- Every generated file matches its source.
- CSS colors come from the design tokens.

If a tool you already use has a rule for the check, configure that tool. If the
check would otherwise need a script, write a vibator rule.
