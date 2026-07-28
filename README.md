<div align="center">
  <h1>Vibator</h1>
  <img src="https://raw.githubusercontent.com/vibator/vibator/main/assets/logo.svg" alt="Vibator Logo" width="128" height="128">

[![Quality](https://github.com/vibator/vibator/actions/workflows/quality.yml/badge.svg)](https://github.com/vibator/vibator/actions/workflows/quality.yml)
[![npm version](https://img.shields.io/npm/v/vibator)](https://www.npmjs.com/package/vibator)
[![node](https://img.shields.io/node/v/vibator)](https://nodejs.org)
[![license: MIT](https://img.shields.io/npm/l/vibator)](./LICENSE)
</div>

Vibator is an unopinionated linter for JavaScript and TypeScript that lets you
write custom rules for your own standards. Every finding links back to the
guideline that defines the standard, and the package ships with skills that hold
coding agents to those standards through actionable alerts.

## Install

```sh
npm install -D vibator
```

Run `npx vibator init` to scaffold a `.vibator.json` and start customizing.
Vibator requires Node 24 or later.

## Why

Vibator started as a way to hold coding agents to a project's standards. Style
guidance written in prompts and guides is not actionable: an agent drifts from
it as its context grows. Vibator gives you a framework to encode such a standard
as a deterministic check with a guideline attached, so when the check fails the
standard reaches the agent.

Vibator exposes a small surface for hooking in rules and leaves the rest of the
machinery to the integrator. The engine loop is thin,
`check → write → recheck → report`, and the only thing the framework imposes is
the severity of a finding (`error`, `warn`, or `off`). The `vibator` namespace
provides common tooling for inspecting a project, parsing
TypeScript and JavaScript, reading JSON and text, and reaching git and the
shell, but it is the rule author who decides how and when to use it, whether a
rule takes options, and whether a rule is fixable. You can rebuild a
conventional linter, turn Vibator into an orchestrator of other linters and
checkers, or write rules that span many files. The only constraints are the
severity of a finding and the shape of the diagnostic a `check` returns;
everything else is yours. The namespace utilities honor the CLI flags, so a rule
that uses them inherits everything they do (checking only staged files,
inspecting from the root, skipping files in `.gitignore`), though none of that
is imposed. Vibator reports in SARIF, so it drops into existing linting
workflows.

## Design

The design docs are the reference and the contract.

| Document                                                   | Covers                                             |
|------------------------------------------------------------|----------------------------------------------------|
| [vibator-namespace.md](./docs/design/vibator-namespace.md) | The `vibator` namespace a rule reads from          |
| [rule-definition.md](./docs/design/rule-definition.md)     | `defineRule`, the rule shape, and the return types |
| [configuration.md](./docs/design/configuration.md)         | `.vibator.json` fields and rule loading            |
| [command-line.md](./docs/design/command-line.md)           | The command, its flags, and the subcommands        |

## Skills

The package ships three skills for Claude Code and compatible agents:

- `configuring-vibator`: inspect a project and write or tune `.vibator.json`.
- `writing-vibator-rules`: author a rule with `defineRule` and the namespace.
- `fixing-vibator-findings`: read a report and resolve its findings.

```sh
npx vibator skills --install     # copy into .claude/skills/
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Participation is governed by the
[Code of Conduct](./CODE_OF_CONDUCT.md). Commits follow Conventional Commits.

## License

[MIT](./LICENSE)
