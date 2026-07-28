---
name: fixing-vibator-findings
description: "Resolve vibator findings: run the JSON reporter, act on each diagnostic's message, expected, and fix, read the guideline behind a rule with explain, and apply a fixable rule with --write. Use when a vibator run reports errors or warnings, or before declaring work done in a repo with a .vibator.json."
---

# Fixing vibator findings

Run the gate as JSON. The output is built to be acted on:

```sh
npx vibator --reporter json
```

Each finding carries `ruleId` and `severity`, the location (`file`, `line`,
`column`), and three fields with distinct jobs:

- `message` — what is wrong. Read it to locate the problem.
- `expected` — the standard, stated positively. This is the target state.
- `fix` — the concrete next action. Act on this field.

## The loop

1. Run `npx vibator --reporter json`. While iterating, scope to your work with
   `--changed` (uncommitted changes) or `--since origin/main` (the branch's
   diff), and `--only <id>` to focus one rule.
2. Group findings by `ruleId` and work rule by rule. Many findings from one
   rule usually share one cause.
3. Apply the `fix`. When it is not enough, read the guideline with
   `npx vibator explain <id>`. It states why the rule exists and what correct
   code looks like, including the exception policy.
4. If the rule is fixable, `npx vibator --write` runs its fix and rechecks.
   Otherwise edit the code yourself.
5. Re-run until clean. Exit code 0 is done. Warnings do not block, but treat
   them the same in code you touched.

## What not to do

- Never edit `.vibator.json` to make a run pass. No severity downgrades, no new
  excludes, no `off`. The config is the project's standard; changing it is a
  human decision, not a fix. This covers any config it extends.
- Do not restate `message` as a code comment. Fix it.
- Do not blanket-ignore. The escape hatch is for the case where the rule is
  wrong about one specific line:

  ```ts
  // vibator-ignore no-todo-without-ticket: tracked on the roadmap, not a ticket
  const value = read();
  ```

  The marker names the rule id, and a reason is optional but should survive
  review. If you write the same reason three times, stop: the code needs a
  different structure, or the rule's configuration needs a human. Say so.
