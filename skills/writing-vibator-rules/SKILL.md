---
name: writing-vibator-rules
description: "Write a vibator rule with defineRule, reading files and code through the vibator namespace and reporting findings. Use when adding a rule to a project's .vibator/ folder or to a vibator plugin package."
---

# Writing a vibator rule

A rule is a module that calls `defineRule`. Importing the module registers it.
Put rule files in the project's `.vibator/` folder, which loads automatically,
or in a package listed under `plugins` in `.vibator.json`.

The full contract is in the vibator design docs:
`node_modules/vibator/docs/design/rule-definition.md` for the rule shape and
`node_modules/vibator/docs/design/vibator-namespace.md` for every namespace
function.

## The rule

```ts
import { defineRule, vibator } from "vibator";

export default defineRule({
  id: "no-todo-without-ticket",
  title: "TODO comments carry a ticket",
  docs: ".vibator/docs/no-todo-without-ticket.md",
  check() {
    const diagnostics = [];
    for (const file of vibator.project.files("**/*.ts")) {
      for (const line of vibator.text.lines(file)) {
        if (/\bTODO\b/.test(line.text) && !/[A-Z]+-\d+/.test(line.text)) {
          diagnostics.push({
            file: file.path,
            line: line.number,
            message: "TODO without a ticket",
            expected: "Every TODO names a ticket",
            fix: "Add the ticket id, or remove the TODO",
          });
        }
      }
    }
    return { diagnostics };
  },
});
```

`id`, `title`, and `docs` are required. `severity` defaults to `error`.
`options` is a zod schema whose parsed value reaches `check`.

## Let the project set the scope

The example above hardcodes `files("**/*.ts")`. To let a project configure the
scope, add the `scope` fragment to `options`. It carries `include` and
`exclude`, and a `!` prefix on a glob excludes it:

```ts
import { defineRule, scope, vibator } from "vibator";

export default defineRule({
  id: "no-todo-without-ticket",
  title: "TODO comments carry a ticket",
  docs: ".vibator/docs/no-todo-without-ticket.md",
  options: scope,
  check({ include, exclude }) {
    const globs = [...include, ...exclude.map((glob) => `!${glob}`)];
    for (const file of vibator.project.files(globs)) {
      // ...
    }
  },
});
```

## Read through the namespace

A rule reads everything through `vibator`. It never touches `fs` or runs `git`
directly.

- `vibator.project.files(glob?)` — the files in scope. Iterate them.
- `vibator.text.lines(file)`, `vibator.text.matches(file, pattern)` — scan text.
- `vibator.ts.parse(file)` — a syntax tree. `.nodes` walks it.
- `vibator.json.parse(file)`, `vibator.json.keys(value)` — read JSON.
- `vibator.git`, `vibator.shell` — version control and commands.

Paths are absolute. Report `file.path`; the run relativizes it for display.

## Report findings

Each diagnostic keeps three fields separate. Never merge them into one sentence.

- `message` — what is wrong.
- `expected` — the standard.
- `fix` — the next action.

Omit `file` for a finding about the whole project.

## Fix under `--write`

Add `fix(options, report)` to correct findings. The framework runs
`check` → `fix` → `check` and reports what the last check leaves. Write files
with `vibator.project.write(path, content)`.

## Honor ignore markers

Skip a finding the author opted out of:

```ts
if (vibator.ignore.line(file, line.number, "no-todo-without-ticket")) continue;
```

A marker reads `vibator-ignore <rule-id>: <reason>` on the line above, or
`vibator-ignore-file <rule-id>: <reason>` anywhere in the file.
