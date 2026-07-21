---
name: fixing-vibator-findings
description: "Act on vibator findings: consume the JSON report, apply each finding's fix, read the guideline behind a rule when the fix is not obvious, verify with a re-run, and use a reasoned ignore only when the rule is genuinely wrong. Use when a vibator run fails, when asked to clean up quality-gate findings, or before declaring work done in a repo that has a vibator.json."
---

# Fixing vibator findings

Run the gate as JSON — it is built to be acted on:

```sh
npx vibator --reporter json
```

Each diagnostic carries three separate fields with distinct jobs:

- `message` — what is wrong. Read it to locate the problem.
- `expected` — the standard, positively stated. This is the target state.
- `fix` — the concrete next action. Act on this field; it is written to be
  executable without further interpretation.

Plus context: `file`/`line` for where, `snippet` for the surrounding source
(triage without opening the file), and `docs` — the guideline in force, with
an `absolutePath` you can read directly when the fix needs background.

## The loop

1. **Run** `npx vibator --reporter json`. During iteration, scope the run to
   your work: `--changed` (uncommitted changes) or `--since origin/main`
   (the branch's whole diff), and `--only <rule>` while working one rule.
2. **Group by `ruleId`, work rule by rule.** Thirty findings from one rule
   usually share one cause and often one mechanical fix.
3. **Apply the `fix`.** When it is not enough, read the guideline at
   `docs[0].absolutePath` (or `npx vibator explain <rule>`) — it states why
   the rule exists and what good looks like, including the exception policy.
4. **Re-run** the same command until clean. Exit code 0 with no errors is
   done; warnings do not block but deserve the same treatment when they are
   in code you touched.

## What not to do

- **Never edit `vibator.json` to make a run pass** — no severity downgrades,
  no new excludes, no `off`. The config is the project's standard; changing
  the standard is a human decision, not a fix.
- **Do not restate `message` as a code comment** or otherwise annotate the
  violation. Fix it.
- **Do not blanket-ignore.** The escape hatch exists for the case where the
  rule is genuinely wrong about one line:

  ```ts
  // vibator-ignore: hot path — runs per audio frame of a live call
  for (let index = 0; index < input.length; index++) {
  ```

  The reason is mandatory and must survive review. If you find yourself
  writing the same reason three times, stop — either the code wants a
  different shape, or the rule's configuration needs a human's attention;
  say so instead.

## Reading failures that are not findings

A rule with an `error` field in the JSON crashed rather than judged. That is
config or environment, not code: a missing tsconfig, a generator that needs a
service, a locales root that moved. Fix the configuration (see the
`configuring-vibator` skill) or report it — do not paper over it.
