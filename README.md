# vibator

[![Quality](https://github.com/vibator/vibator/actions/workflows/quality.yml/badge.svg)](https://github.com/vibator/vibator/actions/workflows/quality.yml)
[![npm version](https://img.shields.io/npm/v/vibator)](https://www.npmjs.com/package/vibator)
[![node](https://img.shields.io/node/v/vibator)](https://nodejs.org)
[![license: MIT](https://img.shields.io/npm/l/vibator)](./LICENSE)

vibator is a quality gate engine: a runner for configurable, glob-scoped
rules. Every finding carries three separate fields (`message`, `expected`,
`fix`), the source lines around it, and a path to the document that states
the standard. The output is meant to be read by humans and consumed directly
by CI tooling and coding agents.

## Why

Linters check syntax and type checkers check types. Neither catches a class
of defects that is common in generated and fast-moving code: files that grow
without limit, a translation key added to one locale only, an environment
variable that is read but never documented, generated files that were never
regenerated, calls to deprecated APIs that still compile.

vibator does not replace a formatter, a linter, a type checker or a dead-code
tool. It covers checks those tools do not.

## Install

```sh
npm install --save-dev vibator
pnpm add -D vibator
yarn add -D vibator
bun add -d vibator
```

Requires Node 22 or later. TypeScript is an optional peer dependency, needed
only by the AST-based rules; the type-aware rules resolve and use the
project's own TypeScript installation. Supported versions are 5.4 up to 6.x;
TypeScript 7 is not yet supported because its native compiler does not
expose the JS compiler API the rules use.

## Usage

```sh
npx vibator                       # run every enabled rule
npx vibator --only max-lines      # run one
npx vibator --reporter json       # machine-readable output
npx vibator --staged              # check only files staged for the next commit
npx vibator --changed             # check only uncommitted changes
npx vibator --since origin/main   # check only what this branch touched
npx vibator list                  # every rule and its default severity
npx vibator explain max-lines     # the guideline behind a rule
npx vibator init                  # write a starter vibator.json
```

The exit code is 1 when any error-severity finding is reported. Warnings do
not fail the run. Every rule runs even after one fails.

`--since origin/main` is the recommended way to adopt vibator on a codebase
with existing violations: new work is checked immediately, old files are
checked when they are next touched, and no baseline file is needed.

## Configuration

`vibator.json` at the project root. See
[docs/configuration.md](./docs/configuration.md) for the full reference and
[docs/rule-catalog.md](./docs/rule-catalog.md) for every rule and option.

```json
{
  "$schema": "./node_modules/vibator/schema.json",
  "rules": {
    "no-conflict-markers": "error",
    "max-lines": [
      { "include": ["src/**/*.{ts,tsx}"], "options": { "max": 400 } },
      { "include": ["tests/**"], "options": { "max": 800 } }
    ],
    "env-example-sync": "warn",
    "locale-parity": "off"
  },
  "guidelines": {
    "docs/code-style.md": ["max-lines", "meaningful-names"]
  }
}
```

Each rule takes `severity` (`error`, `warn` or `off`), `include`, `exclude`
and its own `options`. A bare string is shorthand for the severity. An array
of blocks runs the rule once per block, so different areas of a codebase can
have different budgets. Rules absent from the config still run at their
default severity.

`guidelines` maps your own documents onto rules, so a finding points at your
standards as well as the rule's own guideline.

## Rules

| Rule                   | Default | Checks                                          |
|------------------------|---------|-------------------------------------------------|
| `no-conflict-markers`  | error   | Committed merge conflict markers                |
| `max-file-size`        | error   | Oversized files committed by mistake            |
| `max-lines`            | error   | Files over a line budget                        |
| `banned-patterns`      | off*    | Project-specific banned patterns, in plain JSON |
| `no-dead-doc-links`    | error   | Relative Markdown links that resolve to nothing |
| `locale-parity`        | off*    | Locales missing keys the source locale has      |
| `env-example-sync`     | warn    | Env vars read but undocumented, and vice versa  |
| `tsdoc-coverage`       | error   | Missing or incomplete TSDoc                     |
| `meaningful-names`     | error   | Placeholder identifiers (`data`, `res`, `tmp`)  |
| `prefer-array-methods` | warn    | Single-statement loops that could be `map`      |
| `no-deprecated-apis`   | error   | Calls into `@deprecated` declarations           |
| `codegen-drift`        | off*    | Generated files out of date with their source   |

\* Off until configured. These rules need project-specific options (patterns
to ban, a locales directory, generator commands) before they can run.

`vibator explain <rule>` prints the full guideline for any rule.

`banned-patterns` is the fastest way to add a project-specific check: each
entry is a regular expression with its own `message`, `expected` and `fix`,
configured in JSON without writing a plugin.

## Design notes

- **No baselines.** There is no suppression file. A single line can be
  exempted with `// vibator-ignore: <reason>`, and the reason is required.
  For incremental adoption, scope the run with `--changed` or `--since`.
- **Discovery defers to git.** The candidate file set is what git tracks plus
  what it would keep, so `.gitignore` is honored and generated output is
  never reported.
- **Shared analysis.** Rules that need type information share one TypeScript
  program per tsconfig. Syntax-only rules share one parse per file.
- **Few dependencies.** Globbing and terminal colors come from Node itself.
  The only runtime dependency is `zod`.

## Writing your own rules

If the standard is expressible as a regular expression over lines, configure
`banned-patterns` instead of writing code. Otherwise a rule is a plain object
with an `id`, a guideline, an options schema, glob defaults, and either
`checkFile` (per file) or `check` (per project):

```ts
// vibator-rules/no-direct-env-access.ts
import { defineRule } from "vibator";
import { z } from "zod";

export default defineRule({
  id: "no-direct-env-access",
  title: "Configuration is read through the config module",
  docs: "no-direct-env-access.md",
  scope: "file",
  defaultSeverity: "error",
  defaultInclude: ["src/**/*.ts"],
  defaultExclude: ["src/config/**"],
  optionsSchema: z.object({ module: z.string().default("src/config") }),

  checkFile({ file, bytes, options }) {
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

Register it like a built-in:

```json
{
  "plugins": ["./vibator-rules/no-direct-env-access.ts"],
  "rules": { "no-direct-env-access": "error" }
}
```

`plugins` takes repo-relative paths (TypeScript included, on Node 22.18+) or
package names, so rule packs can be published and shared. See
[docs/writing-rules.md](./docs/writing-rules.md) for the full authoring
guide.

## Agent skills

The package ships three skills for Claude Code and compatible agents:

- `configuring-vibator`: inspect a project and write a fitting configuration.
- `fixing-vibator-findings`: consume the JSON report and resolve findings.
- `writing-vibator-rules`: author a project rule, its guideline and tests.

```sh
npx vibator skills --install     # copy into .claude/skills/
npx vibator skills               # list what is bundled
```

## Guidelines

Every rule ships a guideline in `docs/rules/`. It is what
`vibator explain <rule>` prints and what findings point at.

To replace a rule's guideline with your own document:

```json
"max-lines": { "docs": "docs/our-file-length-policy.md" }
```

To add project context without replacing the shipped guideline:

```json
"guidelines": { "docs/code-style.md": ["max-lines", "meaningful-names"] }
```

## Documentation

| Document                                         | Covers                                               |
|--------------------------------------------------|------------------------------------------------------|
| [docs/configuration.md](./docs/configuration.md) | Config format, CLI, severities, globs, JSON reporter |
| [docs/rule-catalog.md](./docs/rule-catalog.md)   | Every rule, its defaults and options (generated)     |
| [docs/writing-rules.md](./docs/writing-rules.md) | Authoring rules and publishing rule packs            |
| [docs/rules/](./docs/rules)                      | One guideline per built-in rule                      |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Participation is governed by the
[Code of Conduct](./CODE_OF_CONDUCT.md). Commits follow Conventional Commits;
releases are cut by semantic-release and published to npm through OIDC
trusted publishing.

## License

[MIT](./LICENSE)
