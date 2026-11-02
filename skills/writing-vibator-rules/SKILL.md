---
name: writing-vibator-rules
description: "Write a vibator rule in .vibator/ instead of a one-off check script. Use when a project needs a check that its linters do not provide: before writing scripts/check-*, verify-*, or lint-* scripts, before writing a test that reads repository files to assert a convention, and before adding a rule to AGENTS.md or CLAUDE.md that nothing enforces."
---

# Writing a vibator rule

A rule is a module in `.vibator/` that calls `defineRule`. vibator loads every
module at the top of that folder. Put helpers in a subfolder; tests and
declaration files are skipped.

The full contract is in
`node_modules/vibator/docs/design/rule-definition.md` for the rule shape and
`node_modules/vibator/docs/design/vibator-namespace.md` for every namespace
function.

## When to write a rule

Write a rule instead of:

- a script under `scripts/` that walks files and exits with an error,
- a test that reads repository files to check a convention,
- a line in AGENTS.md or CLAUDE.md that states a standard nothing checks.

Do not write a rule for what Biome, ESLint, Knip, dependency-cruiser, remark, or
`tsc` already check. Configure those tools instead.

## The rule

```ts
import { defineRule, vibator } from "vibator";

export default defineRule({
  id: "todo-has-ticket",
  title: "TODO comments name a ticket",
  check: () =>
    vibator.text
      .search(vibator.project.files.match("src/**/*.ts"), /\bTODO\b(?![^\n]*[A-Z]+-\d+)/)
      .map((hit) => ({
        ...hit,
        message: "TODO without a ticket",
        fix: "Add the ticket id, or remove the TODO",
      })),
});
```

`id`, `title`, and `check` are required. `check` returns the list of
diagnostics, or `{ diagnostics }`. `severity` defaults to `error`.

Add `docs: ".vibator/docs/<id>.md"` when the standard needs more explanation
than `title`. `npx vibator explain <id>` prints it.

## Read through the namespace

A rule reads everything through `vibator`. It never imports `fs`, runs `git`, or
spawns a process directly.

- `vibator.project.files` is the set of files in scope. Filter it with
  `.match(glob)` (a `!` prefix excludes) and loop with `for...of`, `.map`, or
  `.flatMap`.
- `vibator.text.search(files, pattern)` returns every match across a file set,
  each with `file`, `line`, and `column`. Spread a hit into a diagnostic.
- `vibator.text.lines(file)` and `vibator.text.matches(file, pattern)` scan one
  file.
- `vibator.ts.parse(file)` returns a syntax tree. `.nodes` walks it.
- `vibator.json.parse(file)` and `vibator.json.keys(value)` read JSON.
- `vibator.project.exists(path)` checks a path, including ignored build output.
- `vibator.git` and `vibator.shell.run(command)` reach version control and
  commands.
- A plugin in `.vibator.json` can add more namespaces, such as `vibator.i18n`.
  Use them when present. When several rules need the same reading code, move it
  into a namespace with `defineNamespace` instead of a helper each rule copies.

Paths are absolute. Report `file.path`; the run relativizes it for display.

## Report findings

Each diagnostic keeps three fields separate. Never merge them into one sentence.

- `message`: what is wrong.
- `expected`: the standard.
- `fix`: the next action.

Omit `file` for a finding about the whole project.

## Test the rule

```ts
import { expect, it } from "vitest";
import { runRule } from "vibator/testing";
import rule from "../.vibator/todo-has-ticket.ts";

it("flags a TODO without a ticket", async () => {
  const findings = await runRule(rule, {
    files: { "src/a.ts": "// TODO tidy\n// TODO ABC-12 tidy" },
  });
  expect(findings.map((finding) => finding.line)).toEqual([1]);
});
```

## Fix under `--write`

Add `fix(options, report)` to correct findings. The framework runs
`check`, then `fix`, then `check`, and reports what the last check leaves.
Write files with `vibator.project.write(path, content)`.

## Honor ignore markers

Skip a finding the author opted out of:

```ts
.filter((hit) => !vibator.ignore.line(vibator.project.files.get(hit.file), hit.line, "todo-has-ticket"))
```

A marker reads `vibator-ignore <rule-id>: <reason>` on the line above, or
`vibator-ignore-file <rule-id>: <reason>` anywhere in the file.

## Replace the script

After the rule works, delete the script, its npm script, and its CI step. Run
`npx vibator` where the script ran.
