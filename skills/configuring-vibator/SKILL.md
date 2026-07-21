---
name: configuring-vibator
description: "Set up or tune vibator.json for a project: discover what the project has (locales, env files, tsconfigs, generators), enable and configure the rules that fit, wire project guidelines onto rules, and tune severities without weakening the gate. Use when asked to add vibator to a project, configure or adjust its quality gates, enable a specific rule, or when a vibator run fails because a rule is misconfigured."
---

# Configuring vibator

Reference: `npx vibator docs configuration` prints the full config format.
This skill is the workflow; that document is the contract.

Configuration is a discovery task: the right config is determined by what the
project actually contains. Inspect first, write second, run third.

## Ground rules

- **Never weaken a gate to make it pass.** Turning a rule off, widening its
  budget or excluding a file because it currently fails converts a visible
  problem into an invisible one. Fix the finding, or leave the rule failing
  and say so. The only per-line escape is `// vibator-ignore: <reason>`, and
  the reason is mandatory.
- **Configure only what differs from the defaults.** Every rule already runs
  at its own default severity with no config at all. A config that restates
  every default is noise around the lines that matter.
- **`include`/`exclude` replace a rule's defaults**, they do not merge. Copy
  the defaults you still want before narrowing.

## Steps

1. **Start from a valid file.** If no `vibator.json` exists, run
   `npx vibator init` — it writes the `$schema` line that gives editors
   validation. Then `npx vibator list` to see every rule and its default.

2. **Run once, unconfigured**: `npx vibator --reporter json`. This shows
   which rules already pass, which fail, and which crashed for want of
   options. Read counts before diagnostics — a rule with 400 findings needs a
   decision, not 400 fixes today (see step 6).

3. **Discover what the off-by-default rules need.** Each is off because it
   cannot act without project knowledge. Look for it:
   - `locale-parity` — find the locales directory (`locales/`, `i18n/`,
     `public/locales/`…). Note the layout: one directory per locale
     (`layout: "directory-per-locale"`) or one file per locale
     (`"file-per-locale"`), and which locale is the source.
   - `codegen-drift` — read `package.json` scripts for generators
     (`db:generate`, `openapi`, `graphql-codegen`…) and find the paths each
     writes. Configure one entry per generator with `name`, `command`,
     `paths`.
   - `banned-patterns` — read the project's review conventions (CONTRIBUTING,
     style docs, recurring PR comments). Every "never do X" that is
     pattern-shaped becomes an entry with its own `message`, `expected` and
     `fix`, written as carefully as a built-in rule's.
   - `no-deprecated-apis` — list the tsconfigs; a monorepo wants each project
     that should be checked in `options.projects`.

4. **Wire existing project documents onto rules** with `guidelines`. If the
   repo has an `AGENTS.md`, `CLAUDE.md` or style doc that states a standard a
   rule enforces, map it: `"guidelines": {"AGENTS.md": ["max-lines"]}`. Use
   the per-rule `docs` field only when the project's standard *replaces* the
   shipped guideline rather than adding context.

5. **Use the array form for split standards.** One rule can run several times
   with different globs and options:

   ```json
   "max-lines": [
     {"include": ["src/**/*.ts"], "options": {"max": 400}},
     {"include": ["tests/**/*.ts"], "options": {"max": 800}}
   ]
   ```

6. **Adopt incrementally on a legacy codebase — with `--changed`, not by
   weakening.** Gate new work immediately (`npx vibator --changed`, or
   `--since origin/main` in CI for the PR's whole diff) while the debt is paid
   down. For rules with many findings, `warn` is the honest interim severity:
   visible, not blocking. Do not use `off` as "later".

7. **Verify the result.** Run `npx vibator` and confirm: every enabled rule
   runs (a crashed rule is a config bug — its message says what was missing),
   the findings that remain are real, and `npx vibator explain <rule>` shows
   the right guideline for anything you overrode.

## Severity policy

- `error` — deterministic rules with near-zero false positives.
- `warn` — rules that can be honestly wrong about a codebase they have not
  seen (`env-example-sync`'s textual matching, `prefer-array-methods` on
  non-array iterables), and interim adoption of debt-heavy rules.
- `off` — only for rules that genuinely do not apply (no locales → no
  `locale-parity`), never as a way to pass.

## Common mistakes

- Writing `include` and losing the rule's default excludes (tests, `.d.ts`).
- Enabling `codegen-drift` with a generator that needs services or secrets
  the environment does not have — the rule runs the command for real.
- Mapping every document onto every rule in `guidelines`; map only documents
  that actually state that rule's standard.
- Editing the config to end a failing run instead of fixing the findings —
  if a human asked for the gate, only a human decides to lower it.
