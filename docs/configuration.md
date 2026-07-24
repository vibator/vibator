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
    "max-file-size": {
      "severity": "error",
      "include": [
        "src/**"
      ],
      "exclude": [
        "**/*.test.*"
      ],
      "options": {
        "maxKb": 256
      },
      "docs": "docs/our-file-size-policy.md"
    },
    "env-example-sync": "warn",
    "locale-parity": "off"
  },
  "guidelines": {
    "docs/code-style.md": [
      "tsdoc-coverage",
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

## `extends`

Configs this one builds on, so a shared preset can carry the standards and
each project states only what differs.

```json
{
  "extends": ["@acme/quality/vibator.json"],
  "rules": { "max-file-size": "warn" }
}
```

An entry is a path starting with `.`, or a package specifier resolved
through that package's `exports`.

- Entries resolve against the file that declares them, so a preset can
  extend another preset.
- Later entries win over earlier ones. The file's own settings win over all
  of them.
- A config that extends itself, directly or through a chain, is an error.

### How settings combine

- A child's fields win one at a time. Unset fields inherit.
- Arrays replace, they do not concatenate. Biome merges the same way.

In practice, a bare severity keeps everything else:

```json
// the preset
"max-file-size": { "options": { "maxKb": 256 }, "include": ["src/**"] }

// your config
"max-file-size": "warn"

// in force: warn severity, still 256kB, still src/**
```

Arrays replace so a project can remove an entry a preset allowed.

Two exceptions:

- The multi-block array form replaces wholesale on either side.
- `root` and `$schema` are never inherited; both describe the file they
  appear in.

### Paths inside a preset

`docs` paths and `guidelines` document keys resolve against the config that
states them, not against your project root. A preset can ship the documents
explaining its standards, and findings in your repository point at them with
a working absolute path:

```json
// @acme/quality/vibator.json
"max-file-size": { "docs": "guides/file-size.md" }
```

resolves to `node_modules/@acme/quality/guides/file-size.md`, and the JSON
reporter reports that as the `absolutePath` an agent can open. Paths in your
own config resolve against your project root.

---

## `rules`

Keyed by rule id. The value is a severity string, a settings block, or an
array of settings blocks.

```json
"max-file-size": "warn"
```

is shorthand for

```json
"max-file-size": {"severity": "warn"}
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

An unknown rule id is an error, so a typo cannot silently disable a check.

Rules absent from `rules` still run at their default severity, unless
[`recommended`](#recommended) is `false`.

### Several instances of one rule

The array form runs a rule once per block, so different areas of one codebase
can have different settings:

```json
"max-file-size": [
  {"include": ["src/**"], "options": {"maxKb": 256}},
  {"include": ["assets/**"], "options": {"maxKb": 4096}}
]
```

Each block resolves independently, with its own severity, globs and options.
All blocks report under the same rule id.

### Severity

`error` fails the run (exit code 1). `warn` reports without failing. `off`
disables the rule entirely: it is not discovered, not run, and costs nothing.

Rules that can produce false positives default to `warn`
(`env-example-sync` matches text; `prefer-array-methods` cannot tell an
array from a `Set`).

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

## `recommended`

Whether rules this config never names run at their own default severity.
`true` unless set otherwise.

```json
{
  "recommended": false,
  "rules": { "max-file-size": "error", "no-conflict-markers": "error" }
}
```

This config runs two rules and nothing else.

- With `recommended: true` (the default), unnamed rules also run, each at
  its own default severity. That keeps a fresh install useful with no
  config at all.
- Once `recommended` is `false`, a rule runs only if the config names it.
  A rule listed without a severity runs at its own default, so
  `"max-file-size": {}` is enough to enable one.
- Rules whose default severity is `off` are unaffected either way; they
  never run unconfigured.
- Under `extends`, the nearest config wins. A preset can set it `false`
  and hand down a curated list; a project extending that preset can set it
  back to `true`.

Set it `false` to state a deliberate selection, not to quiet a failing run:
it disables every unlisted rule, the passing ones included.

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
  "docs/code-style.md": ["tsdoc-coverage", "meaningful-names"],
  "AGENTS.md": ["locale-parity", "codegen-drift"]
}
```

These are additive: they appear alongside the rule's own guideline under
each finding. To replace a rule's guideline instead, use the per-rule `docs`
field.

---

## Command line

```sh
vibator                      # run every enabled rule
vibator --only tsdoc-coverage  # comma-separated rule ids
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
are next touched, and no baseline file is needed.

Project-scoped rules that read sources of their own (a generator's output, a
locale tree) are not narrowed: these flags filter the file list, not what a
rule reads.

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
      "ruleId": "meaningful-names",
      "title": "Identifiers say what they hold",
      "files": 144,
      "durationMs": 34,
      "diagnostics": [
        {
          "file": "src/components/editor.tsx",
          "line": 401,
          "message": "\"data\" is a filler name that says nothing about the value",
          "expected": "A name stating what the value is",
          "fix": "Rename it after what it holds, such as the entity or unit",
          "ruleId": "meaningful-names",
          "severity": "error",
          "docs": [
            {
              "path": "rules/meaningful-names.md",
              "absolutePath": "/repo/node_modules/vibator/docs/rules/meaningful-names.md"
            },
            {
              "path": "docs/code-style.md",
              "absolutePath": "/repo/docs/code-style.md"
            }
          ],
          "snippet": "  400 | }\n> 401 | const data = fetchRows();"
        }
      ]
    }
  ]
}
```

- `message`, `expected` and `fix` stay separate so an agent can act on
  `fix` without parsing prose.
- `docs` lists the guideline in force first, then any project documents
  mapped to the rule. Each `absolutePath` works wherever the package
  manager installed the package.
- `snippet` carries the lines around the finding, so triage costs no extra
  reads.
- A rule that crashed carries an `error` string instead of diagnostics.
