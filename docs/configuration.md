# Configuration

`vibator.json` (or `.vibator.json`) at the project root. Every field is
optional; with no config at all, every built-in rule runs at its own default
severity. `vibator init` writes a valid starting point.

```json
{
  "$schema": "./node_modules/vibator/schema.json",
  "plugins": [
    "./vibator-rules/no-direct-env-access.ts"
  ],
  "rules": {
    "no-conflict-markers": "error",
    "max-lines": {
      "severity": "error",
      "include": [
        "src/**/*.{ts,tsx}"
      ],
      "exclude": [
        "**/*.test.*"
      ],
      "options": {
        "max": 400
      },
      "docs": "docs/our-file-length-policy.md"
    },
    "env-example-sync": "warn",
    "locale-parity": "off"
  },
  "guidelines": {
    "docs/code-style.md": [
      "max-lines",
      "meaningful-names"
    ]
  }
}
```

The `$schema` line gives editor autocomplete and inline validation for every
rule's options. It is regenerated from the rules themselves on each build, so it
cannot drift from what the tool accepts. Under a layout with no `node_modules`
— Yarn PnP, notably — reference the published schema instead:

```json
"$schema": "https://unpkg.com/vibator@0.0.1/schema.json"
```

`vibator init` picks whichever form resolves for your install.

---

## `rules`

Keyed by rule id. The value is a severity string, a block, or an array of
blocks.

```json
"max-lines": "warn"
```

is shorthand for

```json
"max-lines": {"severity": "warn"}
```

| Field      | Default             | Meaning                                                      |
|------------|---------------------|--------------------------------------------------------------|
| `severity` | the rule's own      | `"error"`, `"warn"` or `"off"`.                              |
| `include`  | the rule's own      | Globs selecting files. **Replaces** the default, not merged. |
| `exclude`  | the rule's own      | Globs removed from that selection. Replaces the default.     |
| `options`  | the rule's defaults | Validated against the rule's schema.                         |
| `docs`     | the rule's own      | Path to a guideline that replaces the shipped one.           |

Every rule's defaults and every option it accepts are listed in the
**[rule catalog](./rule-catalog.md)** (`vibator docs rules`), generated from
the rules' own schemas on each build.

An unknown rule id is an error rather than ignored — a typo that silently
disables a gate is worse than a failed run.

**Rules absent from `rules` still run**, at their default severity. Configuring
nothing gives you everything, and switching one off costs one line. A tool that
checks nothing until fully configured tends to stay that way.

### Several instances of one rule

The array form runs a rule once per block, so different areas of one codebase
can be held to different standards:

```json
"max-lines": [
{"include": ["src/**/*.ts"], "options": {"max": 400}},
{"include": ["tests/**/*.ts"], "options": {"max": 800}}
]
```

Each block resolves independently — its own severity, globs and options — and
each reports under the same rule id.

### Severity

`error` fails the run (exit 1). `warn` reports without failing. `off` skips the
rule entirely — it is not discovered, not run, and costs nothing.

Warnings are for rules that can reasonably be wrong on a codebase they have not
seen. `env-example-sync` ships as `warn` for exactly that reason: it matches
configuration reads textually, and an unusual access pattern can fool it.
`prefer-array-methods` ships as `warn` because it is syntactic and cannot tell
an array from a `Set`.

### Globs

Matched against repo-relative paths with `node:path`'s `matchesGlob`. `include`
and `exclude` replace the rule's defaults rather than extending them, so copy
the defaults you still want — `vibator list` and the rule's source show them.

`node_modules`, `dist`, `build`, `coverage` and `.git` are always excluded.

Discovery defers to git: the candidate set is what `git` tracks plus what it
would keep (`--others --exclude-standard`), so `.gitignore` is honoured and
generated output is never reported. Outside a git repository it falls back to
walking the filesystem.

---

## `plugins`

Paths or package names of modules contributing rules. See
[writing-rules.md](./writing-rules.md).

```json
"plugins": ["./vibator-rules/index.ts", "vibator-rules-acme"]
```

Loaded in order, after the built-ins. Plugin rules are configured under `rules`
exactly like built-in ones.

---

## `guidelines`

Maps your own documents onto rules. Document path to rule ids:

```json
"guidelines": {
"docs/code-style.md": ["max-lines", "meaningful-names"],
"AGENTS.md": ["locale-parity", "codegen-drift"]
}
```

These are **additive** — they appear alongside the rule's own guideline under
each finding. To *replace* a rule's guideline, use the per-rule `docs` field
instead.

Both exist because they answer different questions. `docs` says "our standard
differs from yours". `guidelines` says "your standard is right, and here is
where our project applies it".

---

## Command line

```sh
vibator                      # run every enabled rule
vibator --only max-lines     # comma-separated rule ids
vibator --config path.json   # explicit config file
vibator --reporter json      # machine-readable output
vibator --staged             # judge only files staged for the next commit
vibator --changed            # judge only uncommitted changes
vibator --since origin/main  # judge only files changed since a ref
vibator list                 # every rule, its default severity and title
vibator explain <rule>       # the guideline in force for a rule
vibator docs <topic>         # print a bundled document (writing-rules, configuration, rules)
vibator init                 # write a starter vibator.json
vibator skills               # where the bundled agent skills live
vibator skills --install     # copy them into .claude/skills/
```

Exit code is 1 when any `error`-severity finding is reported, or when a rule
itself crashes. Warnings alone exit 0. `--help` and `--version` do what they
say.

Every rule runs even after one fails. Stopping at the first failure hides the
rest of the picture behind whichever gate happens to be ordered first.

Colour is emitted when stderr is a TTY, and suppressed under `NO_COLOR`.

### Change-scoped runs

Three flags narrow a run to the files a change touched, composing by union
when combined:

- `--staged` — files staged for the next commit, and nothing else. Built for
  pre-commit hooks: `vibator --staged --only no-conflict-markers,max-file-size`
  gates what the commit records in milliseconds. Like staged-mode formatters,
  content is judged as it stands in the working tree, so a partially staged
  file is checked at its on-disk state.
- `--changed` — every uncommitted change: staged, unstaged and untracked.
- `--since <ref>` — everything the current branch changed since diverging
  from `<ref>`, plus uncommitted work. The right scope for a pull request
  gate:

```sh
vibator --since origin/main --reporter json
```

This is the supported way to adopt vibator on a codebase with existing debt:
new work is gated immediately, old files are judged when they are next
touched, and no baseline file ever records the debt as acceptable. Note that
project-scoped rules consulting sources of their own — a generator's output, a
locale tree — still judge what they judge; the restriction narrows the file
list, it does not sandbox the rule.

---

## The JSON reporter

For CI, and for agents acting on findings:

```json
{
  "ok": false,
  "errors": 12,
  "warnings": 0,
  "durationMs": 5720,
  "rules": [
    {
      "ruleId": "max-lines",
      "title": "No source file longer than the budget",
      "files": 144,
      "durationMs": 34,
      "diagnostics": [
        {
          "file": "src/components/editor.tsx",
          "line": 401,
          "message": "1091 lines exceeds the 400-line budget",
          "expected": "At most 400 lines",
          "fix": "Split it into focused modules, each with one reason to change",
          "ruleId": "max-lines",
          "severity": "error",
          "docs": [
            {
              "path": "rules/max-lines.md",
              "absolutePath": "/repo/node_modules/vibator/docs/rules/max-lines.md"
            },
            {
              "path": "docs/code-style.md",
              "absolutePath": "/repo/docs/code-style.md"
            }
          ],
          "snippet": "  399 | }\n  400 |\n> 401 | export function anotherHandler() {"
        }
      ]
    }
  ]
}
```

`message`, `expected` and `fix` stay separate fields so a tool can act on `fix`
without parsing intent out of prose. `docs` lists the guideline in force first,
then any project documents mapped to the rule — each with an `absolutePath`
that can be opened directly, wherever the package manager put the package.
`snippet` shows the lines around the finding, so triage does not need a second
read of the file. A rule that crashed carries an `error` string instead of
diagnostics.
