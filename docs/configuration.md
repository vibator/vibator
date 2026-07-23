# Configuration

Vibator reads `vibator.json` (or `.vibator.json`) at the project root. Every
field is optional. With no config file at all, every built-in rule runs at
its own default severity. `vibator init` writes a valid starting point.

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

The `$schema` line enables editor autocomplete and inline validation for
every rule's options. The schema is regenerated from the rules themselves on
each build, so it cannot drift from what the tool accepts. In a layout
without `node_modules` (Yarn PnP, for example), reference the published
schema instead:

```json
"$schema": "https://unpkg.com/vibator@0.1.0/schema.json"
```

`vibator init` picks whichever form resolves for your install.

---

## `rules`

Keyed by rule id. The value is a severity string, a settings block, or an
array of settings blocks.

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
[rule catalog](./rule-catalog.md), also available as `vibator docs rules`.
The catalog is generated from the rules' own schemas on each build.

An unknown rule id is an error rather than being ignored, so a typo cannot
silently disable a check.

Rules absent from `rules` still run, at their default severity. Configuring
nothing enables everything, and switching one rule off is a single line.

### Several instances of one rule

The array form runs a rule once per block, so different areas of one codebase
can have different settings:

```json
"max-lines": [
  {"include": ["src/**/*.ts"], "options": {"max": 400}},
  {"include": ["tests/**/*.ts"], "options": {"max": 800}}
]
```

Each block resolves independently, with its own severity, globs and options.
All blocks report under the same rule id.

### Severity

`error` fails the run (exit code 1). `warn` reports without failing. `off`
disables the rule entirely: it is not discovered, not run, and costs nothing.

Rules that can produce false positives on unusual codebases default to
`warn`. `env-example-sync` matches configuration reads textually, and
`prefer-array-methods` is syntactic and cannot distinguish an array from a
`Set`, so both ship as warnings.

### Globs

Globs are matched against repo-relative paths with `node:path`'s
`matchesGlob`. `include` and `exclude` replace the rule's defaults rather
than extending them; copy the defaults you want to keep. `vibator list` and
the [rule catalog](./rule-catalog.md) show them.

`node_modules`, `dist`, `build`, `coverage` and `.git` are always excluded.

Discovery defers to git: the candidate set is what git tracks plus what it
would keep (`--others --exclude-standard`), so `.gitignore` is honored and
generated output is never reported. Outside a git repository, discovery falls
back to walking the filesystem.

---

## `plugins`

Paths or package names of modules contributing rules. See
[writing-rules.md](./writing-rules.md).

```json
"plugins": ["./vibator-rules/index.ts", "vibator-rules-acme"]
```

Plugins load in order, after the built-ins. Plugin rules are configured under
`rules` exactly like built-in ones.

---

## `guidelines`

Maps your own documents onto rules, document path to rule ids:

```json
"guidelines": {
  "docs/code-style.md": ["max-lines", "meaningful-names"],
  "AGENTS.md": ["locale-parity", "codegen-drift"]
}
```

These are additive: they appear alongside the rule's own guideline under each
finding. To replace a rule's guideline, use the per-rule `docs` field
instead.

The two exist for different situations. `docs` states that your standard
differs from the shipped one. `guidelines` points readers at the place where
your project commits to the standard the rule already enforces.

---

## Command line

```sh
vibator                      # run every enabled rule
vibator --only max-lines     # comma-separated rule ids
vibator --config path.json   # explicit config file
vibator --reporter json      # machine-readable output
vibator --staged             # check only files staged for the next commit
vibator --changed            # check only uncommitted changes
vibator --since origin/main  # check only files changed since a ref
vibator list                 # every rule, its default severity and title
vibator explain <rule>       # the guideline in force for a rule
vibator docs <topic>         # print a bundled document (writing-rules, configuration, rules)
vibator init                 # write a starter vibator.json
vibator skills               # list the bundled agent skills
vibator skills --install     # copy them into .claude/skills/
```

The exit code is 1 when any error-severity finding is reported, or when a
rule itself crashes. Warnings alone exit 0. `--help` and `--version` behave
as expected.

Every rule runs even after one fails, so a failing check never hides the
results of the others.

Color is emitted when stderr is a TTY and suppressed under `NO_COLOR`.

### Change-scoped runs

Three flags narrow a run to the files a change touched. They combine by
union.

- `--staged`: files staged for the next commit, and nothing else. Intended
  for pre-commit hooks, for example
  `vibator --staged --only no-conflict-markers,max-file-size`. As with
  staged-mode formatters, content is read from the working tree, so a
  partially staged file is checked at its on-disk state.
- `--changed`: every uncommitted change (staged, unstaged and untracked).
- `--since <ref>`: everything the current branch changed since diverging
  from `<ref>`, plus uncommitted work. This is the right scope for a pull
  request check:

```sh
vibator --since origin/main --reporter json
```

This is also the supported way to adopt vibator on a codebase with existing
violations: new work is checked immediately, old files are checked when they
are next touched, and no baseline file is needed. Note that project-scoped
rules that consult sources of their own (a generator's output, a locale tree)
still check what they check; the restriction narrows the file list, it does
not sandbox the rule.

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

`message`, `expected` and `fix` stay separate so an agent can act on `fix`
without parsing prose. `docs` lists the guideline in force first, then any
project documents mapped to the rule, each with an `absolutePath` it can open
directly, wherever the package manager installed the package. `snippet`
carries the lines around the finding, so triage costs no extra reads. A rule
that crashed carries an `error` string instead of diagnostics.
