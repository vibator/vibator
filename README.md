# vibator

[![Quality](https://github.com/vibator/vibator/actions/workflows/quality.yml/badge.svg)](https://github.com/vibator/vibator/actions/workflows/quality.yml)
[![npm version](https://img.shields.io/npm/v/vibator)](https://www.npmjs.com/package/vibator)
[![node](https://img.shields.io/node/v/vibator)](https://nodejs.org)
[![license: MIT](https://img.shields.io/npm/l/vibator)](./LICENSE)
[![semantic-release](https://img.shields.io/badge/semantic--release-conventional%20commits-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)

AI-first quality gates. Configurable, glob-scoped rules that tell you — and an
agent — what is wrong, what was expected, and where the standard is written
down.

## Why

Linters check syntax. Type checkers check types. Neither catches the things
generated code actually gets wrong: files that grow without limit, a locale key
seeded to one language, an env var read but never documented, a migration that
was never regenerated, a deprecated API that still compiles.

Every finding carries three separate fields — `message`, `expected` and `fix` —
so a human reads one sentence and an agent consuming `--reporter json` can act
without parsing intent out of prose. Findings also carry the source lines
around them and a resolvable path to the guideline behind the rule.

vibator deliberately does **not** compete with your formatter, linter, type
checker or dead-code tool. It fills the holes they leave.

## Install

```sh
npm install --save-dev vibator     # or: pnpm add -D / yarn add -D / bun add -d
```

Requires Node ≥ 22, any package manager. TypeScript is an optional peer
dependency, needed only by the AST rules.

## Use

```sh
npx vibator                       # run every enabled rule
npx vibator --only max-lines      # run one
npx vibator --reporter json       # machine-readable
npx vibator --staged              # judge only what the next commit records
npx vibator --changed             # judge only uncommitted changes
npx vibator --since origin/main   # judge only what this branch touched
npx vibator list                  # every rule and its default severity
npx vibator explain max-lines     # the guideline behind a rule
npx vibator init                  # write a starter vibator.json
```

Exit code is 1 when any `error`-severity finding is reported. Warnings do not
fail the run. Every rule runs even after one fails, so one red gate never hides
the rest.

`--since origin/main` is the adoption path for a codebase with existing debt:
new work is gated immediately, old files are judged when next touched, and no
baseline file ever records the debt as acceptable.

## Configure

**→ [docs/configuration.md](./docs/configuration.md)** is the full reference.
In short, `vibator.json` at the project root:

```json
{
  "$schema": "./node_modules/vibator/schema.json",
  "rules": {
    "no-conflict-markers": "error",
    "max-lines": [
      {
        "include": [
          "src/**/*.{ts,tsx}"
        ],
        "options": {
          "max": 400
        }
      },
      {
        "include": [
          "tests/**"
        ],
        "options": {
          "max": 800
        }
      }
    ],
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

Every rule takes `severity` (`error` | `warn` | `off`), `include`, `exclude` and
its own `options`. A bare string is shorthand for severity; an array runs the
rule once per block, so different areas can carry different budgets. Rules
absent from config still run at their default severity — configuring nothing
gives you everything, and `"off"` is always one line away.

`guidelines` maps your own documents onto rules, so a finding points at your
standards as well as the rule's.

## Rules

| Rule                   | Default | Catches                                         |
|------------------------|---------|-------------------------------------------------|
| `no-conflict-markers`  | error   | Committed merge conflict markers                |
| `max-file-size`        | error   | Build output and artifacts committed by mistake |
| `max-lines`            | error   | Files grown past having one job                 |
| `banned-patterns`      | off*    | Whatever your project bans — in pure JSON       |
| `no-dead-doc-links`    | error   | Markdown links pointing at files that moved     |
| `locale-parity`        | off*    | A translation key seeded to some locales only   |
| `env-example-sync`     | warn    | Env vars read but undocumented, or vice versa   |
| `tsdoc-coverage`       | error   | Missing or incomplete TSDoc contracts           |
| `meaningful-names`     | error   | `data`, `res`, `tmp` and friends                |
| `prefer-array-methods` | warn    | Single-statement loops that should be `map`     |
| `no-deprecated-apis`   | error   | Calls into `@deprecated` declarations           |
| `codegen-drift`        | off*    | Generated files out of date with their source   |

\* off until configured — these need project knowledge (patterns to ban, a
locales directory, generator commands) before they can act.

`vibator explain <rule>` prints the full guideline for any of them.

`banned-patterns` deserves a special mention: most standards that keep coming
up in code review are pattern-shaped, and it turns them into gates without
writing a plugin — each pattern carries its own `message`, `expected` and
`fix`.

## Design notes

- **No baselines.** There is no suppression file. A gate that lets you record
  violations and move on stops being a gate. Where an exception is genuinely
  right, `// vibator-ignore: <reason>` marks the line — and the reason is
  mandatory. For incremental adoption, scope the run with `--changed` or
  `--since` instead.
- **Discovery defers to git.** The candidate file set is what `git` tracks plus
  what it would keep, so `.gitignore` is honoured and generated output never
  gets reported.
- **One program, shared.** Rules needing type information share a single
  memoized TypeScript program per tsconfig, rather than each building its own;
  syntax-only rules share one parse per file the same way.
- **Near-zero dependencies.** Globbing and colour come from Node itself
  (`fs.globSync`, `util.styleText`). The only runtime dependency is `zod`.

## Writing your own rules

The built-in rules are an opinionated starting set, not the whole story — every
project has standards only it can state. If the standard is pattern-shaped,
configure `banned-patterns` and be done. Otherwise a rule is a plain object
with an `id`, a guideline, an options schema, glob defaults, and either
`checkFile` (per file) or `check` (per project):

```ts
// vibator-rules/no-direct-env-access.ts
import {defineRule} from "vibator";
import {z} from "zod";

export default defineRule({
    id: "no-direct-env-access",
    title: "Configuration is read through the config module",
    docs: "no-direct-env-access.md",
    scope: "file",
    defaultSeverity: "error",
    defaultInclude: ["src/**/*.ts"],
    defaultExclude: ["src/config/**"],
    optionsSchema: z.object({module: z.string().default("src/config")}),

    checkFile({file, bytes, options}) {
        const lines = bytes.toString("utf8").split("\n");
        const index = lines.findIndex((line) => line.includes("process.env"));
        if (index === -1) return [];
        return [{
            file,
            line: index + 1,
            message: "Reads process.env directly",
            expected: `Configuration comes from ${options.module}`,
            fix: `Add the value to ${options.module} and import it from there`,
        }];
    },
});
```

Register it and configure it exactly like a built-in:

```json
{
  "plugins": [
    "./vibator-rules/no-direct-env-access.ts"
  ],
  "rules": {
    "no-direct-env-access": "error"
  }
}
```

`plugins` takes repo-relative paths (TypeScript included, on Node 22.18+) or
package names, so rule packs can be published and shared.

**→ [docs/writing-rules.md](./docs/writing-rules.md)** is the full authoring
guide: both scopes, the shared context, working with the TypeScript AST, escape
hatches, writing the guideline, testing, publishing a rule pack, and what makes
a rule worth writing at all. `npx vibator docs writing-rules` prints it
wherever the package is installed.

## Agent skills

The package ships three Claude Code skills:

- **configuring-vibator** — discover what a project has and write the config
  that fits, without weakening gates to pass them.
- **fixing-vibator-findings** — consume the JSON report, act on each `fix`,
  verify with a re-run, escalate honestly.
- **writing-vibator-rules** — author a project rule, its guideline and tests.

```sh
npx vibator skills --install     # copies into .claude/skills/
npx vibator skills               # just show what is bundled
```

An agent asked to set up or satisfy the gate then follows the same workflow
these documents describe, instead of improvising.

## Guidelines

Every rule ships an opinionated guideline in `docs/rules/`, which is what
`vibator explain <rule>` prints and what findings point at.

Those defaults are a starting position, not a mandate. Point a rule at your own
document and it wins everywhere — in `explain`, and under each finding:

```json
"max-lines": {"docs": "docs/our-file-length-policy.md"}
```

Use `guidelines` instead to *add* project context without replacing the rule's
own guideline:

```json
"guidelines": {"docs/code-style.md": ["max-lines", "meaningful-names"]}
```

## Documentation

| Document                                         | Covers                                                |
|--------------------------------------------------|-------------------------------------------------------|
| [docs/configuration.md](./docs/configuration.md) | Config format, CLI, severities, globs, JSON reporter  |
| [docs/rule-catalog.md](./docs/rule-catalog.md)   | Every rule, its defaults and options (generated)      |
| [docs/writing-rules.md](./docs/writing-rules.md) | Authoring rules and publishing rule packs             |
| [docs/rules/](./docs/rules)                      | One guideline per built-in rule                       |
| `skills/`                                        | Claude Code skills for configuring, fixing, authoring |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md); participation is governed by the
[Code of Conduct](./CODE_OF_CONDUCT.md). Commits follow Conventional Commits;
releases are cut by semantic-release and published to npm via OIDC trusted
publishing.

## Licence

[MIT](./LICENSE)
