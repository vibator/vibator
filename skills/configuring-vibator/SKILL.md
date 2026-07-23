---
name: configuring-vibator
description: "Set up or tune vibator.json for a project: discover what the project has (locales, env files, tsconfigs, generators), enable and configure the rules that fit, wire project guidelines onto rules, and tune severities without weakening the gate. Use when asked to add vibator to a project, configure or adjust its quality gates, enable a specific rule, or when a vibator run fails because a rule is misconfigured."
---

# Configuring vibator

Reference: `npx vibator docs configuration` prints the config format and
`npx vibator docs rules` prints every rule with its options and defaults.
This skill is the workflow; those documents are the contract.

Configuration is a discovery task: the right config is determined by what
the project actually contains. Inspect first, write second, run third.

## Ground rules

- **Never weaken a gate to make it pass.** Turning a rule off, widening its
  budget or excluding a file because it currently fails hides the problem
  instead of fixing it. Fix the finding, or leave the rule failing and say
  so. The only per-line escape is `// vibator-ignore: <reason>`, and the
  reason is required.
- **Configure only what differs from the defaults.** Every rule already runs
  at its own default severity with no config at all. A config that restates
  every default buries the lines that matter.
- **`include` and `exclude` replace a rule's defaults.** They do not merge.
  Copy the defaults you still want before narrowing.
- **A config the project extends is not yours to edit.** A preset states a
  standard several projects share. Configure the difference locally, or ask
  a human to change the preset. Never quieten this repository by editing a
  file under `node_modules`, which the next install replaces anyway.

## Steps

1. **Start from a valid file.** If no `vibator.json` exists, run
   `npx vibator init`; it writes the `$schema` line that gives editors
   validation. Then `npx vibator list` shows every rule and its default.
   Before writing rules of your own, check whether the project already
   extends a preset, or whether one exists to extend (a `@scope/quality`
   style package in `package.json`, or the same config repeated across
   sibling repositories). Extending it beats restating it; see
   "Building on a shared preset" below.

2. **Run once, unconfigured**: `npx vibator --reporter json`. This shows
   which rules pass, which fail, and which crashed for lack of options. Read
   counts before diagnostics; a rule with 400 findings needs a decision, not
   400 fixes today (see step 6).

3. **Discover what the off-by-default rules need.** Each is off because it
   cannot act without project knowledge. Look for it:
   - `locale-parity`: find the locales directory (`locales/`, `i18n/`,
     `public/locales/`). Note the layout: one directory per locale
     (`layout: "directory-per-locale"`) or one file per locale
     (`"file-per-locale"`), and which locale is the source.
   - `codegen-drift`: read `package.json` scripts for generators
     (`db:generate`, `openapi`, `graphql-codegen`) and find the paths each
     writes. Configure one entry per generator with `name`, `command`,
     `paths`.
   - `banned-patterns`: read the project's review conventions (CONTRIBUTING,
     style docs, recurring review comments). Every pattern-shaped "never do
     X" becomes an entry with its own `message`, `expected` and `fix`,
     written as carefully as a built-in rule's.
   - `no-deprecated-apis`: list the tsconfigs; a monorepo wants each project
     that should be checked in `options.projects`.

4. **Wire existing project documents onto rules** with `guidelines`. If the
   repo has an `AGENTS.md`, `CLAUDE.md` or style document that states a
   standard a rule enforces, map it:
   `"guidelines": {"AGENTS.md": ["max-lines"]}`. Use the per-rule `docs`
   field only when the project's standard replaces the shipped guideline
   rather than adding context.

5. **Use the array form for split standards.** One rule can run several
   times with different globs and options:

   ```json
   "max-lines": [
     {"include": ["src/**/*.ts"], "options": {"max": 400}},
     {"include": ["tests/**/*.ts"], "options": {"max": 800}}
   ]
   ```

6. **Adopt incrementally on a legacy codebase with `--changed`, not by
   weakening.** Check new work immediately (`npx vibator --changed`, or
   `--since origin/main` in CI for the pull request's whole diff) while the
   backlog is worked down. For rules with many findings, `warn` is the
   honest interim severity: visible, not blocking. Do not use `off` to mean
   "later".

7. **Verify the result.** Run `npx vibator` and confirm: every enabled rule
   runs (a crashed rule is a config bug and its message says what was
   missing), the remaining findings are real, and
   `npx vibator explain <rule>` shows the right guideline for anything you
   overrode.

## Building on a shared preset

`extends` takes a path starting with `.` or a package specifier, resolved
against the file that declares it. Later entries win over earlier ones, and
the file's own settings win over all of them.

```json
{
  "extends": ["@acme/quality/vibator.json"],
  "rules": { "max-lines": "warn" }
}
```

The merge follows Biome, so the behaviour is what a reader of this stack
already expects. Two consequences to get right:

- **A bare severity keeps everything else.** Writing `"max-lines": "warn"`
  over a preset that set `max` and `include` changes only the severity; the
  budget and globs are inherited. You do not need to restate them, and
  restating them is how a project silently drifts from its preset.
- **Arrays replace, they do not concatenate.** To add one entry to an
  inherited `allow` or `patterns` list, write the whole list you want. This
  is deliberate: it is what makes removing an inherited entry possible.

Write only the difference. A config that repeats what the preset already
says is indistinguishable from one that disagrees with it, and the next
preset update will not reach the fields you copied.

Guideline paths behave accordingly: `docs` and `guidelines` entries stated
by a preset resolve against the preset, so findings point at the prose that
ships with it. Your own paths still resolve against the project root.

## Severity policy

- `error`: deterministic rules with near-zero false positives.
- `warn`: rules that can be wrong about a codebase they have not seen
  (`env-example-sync` matches text; `prefer-array-methods` cannot tell an
  array from a `Set`), and interim adoption of rules with a large backlog.
- `off`: only for rules that do not apply (no locales means no
  `locale-parity`), never as a way to pass.

## Common mistakes

- Writing `include` and losing the rule's default excludes (tests,
  `.d.ts`).
- Restating a preset's options next to a severity override, on the
  assumption that a bare severity discards them. It does not, and the copy
  stops tracking the preset.
- Enabling `codegen-drift` with a generator that needs services or secrets
  the environment does not have. The rule runs the command for real.
- Mapping every document onto every rule in `guidelines`. Map only documents
  that actually state that rule's standard.
- Editing the config to end a failing run instead of fixing the findings.
  If a human asked for the gate, only a human decides to lower it.
