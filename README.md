<h1>
  <img src="https://raw.githubusercontent.com/vibator/vibator/main/assets/logo.svg" width="44" height="44" align="absmiddle" alt="">
  vibator
</h1>

[![Quality](https://github.com/vibator/vibator/actions/workflows/quality.yml/badge.svg)](https://github.com/vibator/vibator/actions/workflows/quality.yml)
[![npm version](https://img.shields.io/npm/v/vibator)](https://www.npmjs.com/package/vibator)
[![node](https://img.shields.io/node/v/vibator)](https://nodejs.org)
[![license: MIT](https://img.shields.io/npm/l/vibator)](./LICENSE)

Project rules instead of check scripts.

Coding agents write a new `scripts/check-*.mjs` each time a project needs a
check that no linter provides. vibator gives those checks one home: a rule is
one file in `.vibator/`, and `npx vibator` runs them all.

If a tool you already use has a rule for a check, configure that tool. vibator
runs the checks that only your project has.

## A rule

```ts
// .vibator/colors-from-tokens.ts
import { defineRule, vibator } from "vibator";

export default defineRule({
  id: "colors-from-tokens",
  title: "CSS colors come from tokens.css",
  check: () =>
    vibator.text
      .search(
        vibator.project.files.match(["src/**/*.css", "!src/styles/tokens.css"]),
        /#[0-9a-f]{3,8}\b/i,
      )
      .map((hit) => ({
        ...hit,
        message: `Hardcoded color ${hit.text}`,
        fix: "Use a variable from tokens.css",
      })),
});
```

```text
$ npx vibator
src/components/card.css:11:23 error colors-from-tokens  Hardcoded color #f97316
```

A rule reads the project through the `vibator` namespace: files, text, JSON,
TypeScript syntax trees, `package.json`, git, and the shell. Each finding keeps
three fields apart: `message` (what is wrong), `expected` (the standard), and
`fix` (the next action), so an agent can act on it.

## Install

```sh
npm install --save-dev vibator
npx vibator init     # writes a starter rule into .vibator/
npx vibator
```

With Bun:

```sh
bun add -d vibator
bunx --bun vibator init
bunx --bun vibator
```

`--bun` runs the binary on Bun. The binary has a `#!/usr/bin/env node` shebang,
so without the flag `bunx vibator` runs on Node whenever Node is installed.

vibator requires Node 24 or later, or Bun 1.4.2 or later.

## Test a rule

```ts
import { runRule } from "vibator/testing";
import rule from "../.vibator/colors-from-tokens.ts";

const findings = await runRule(rule, {
  files: { "src/card.css": "a { color: #fff; }" },
});
```

## Docs

The guides are in [docs/guide](./docs/guide), and the site
[vibator.dev](https://vibator.dev) publishes them. The design docs are the
reference and the contract.

| Document                                                   | Covers                                      |
| ---------------------------------------------------------- | ------------------------------------------- |
| [vibator-namespace.md](./docs/design/vibator-namespace.md) | The `vibator` namespace a rule reads from   |
| [rule-definition.md](./docs/design/rule-definition.md)     | `defineRule`, the rule shape, and `runRule` |
| [configuration.md](./docs/design/configuration.md)         | `.vibator.json` fields and rule loading     |
| [command-line.md](./docs/design/command-line.md)           | The command, its flags, and the subcommands |

## Skills

The package ships three skills for Claude Code and compatible agents:

- `writing-vibator-rules`: write a rule instead of a check script.
- `fixing-vibator-findings`: read a report and resolve its findings.
- `configuring-vibator`: set severities, options, extends, plugins, and excludes.

```sh
npx vibator skills --install     # copy into .claude/skills/
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Participation is governed by the
[Code of Conduct](./CODE_OF_CONDUCT.md). Commits follow Conventional Commits.
[ACCESSIBILITY.md](./ACCESSIBILITY.md) says what the command line and the docs
do for accessibility, and how to report a barrier.

## License

[MIT](./LICENSE)
