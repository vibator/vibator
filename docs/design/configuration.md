# `.vibator.json`

This document is the reference of the `.vibator.json` configuration file: the
fields it accepts and the way the framework loads rules, as they are provided by
the base vibator framework.

A project adds a `.vibator.json` at its root. The file is optional and overrides
the default configuration.

## Reference

- [Fields](#fields) — The top-level fields of the file.
- [rules](#rules) — Per-rule overrides.
- [RuleConfig](#ruleconfig) — The override one rule accepts.
- [Loading](#loading) — How the framework finds and loads rules.

---

## Fields

The top-level fields of the file.

| Declaration | Description |
|---|---|
| $schema?: string | The path or URL of the schema that validates this file. |
| extends?: string[] | Paths or package names of base configs to inherit. |
| plugins?: string[] | Paths or package names of rule modules that live outside `.vibator/`. |
| exclude?: string[] | Directory names to skip during file discovery, replacing the built-in defaults. |
| rules?: Record\<string, [Severity](./rule-definition.md#severity) \| [RuleConfig](#ruleconfig)\> | Per-rule overrides, keyed by rule id. |

## rules

A rule entry is a [RuleConfig](#ruleconfig). A severity shorthand exists for
convenience: a bare [Severity](./rule-definition.md#severity) stands for that
severity alone, so `{ "no-deprecated-apis": "off" }` reads as
`{ "no-deprecated-apis": { "severity": "off" } }`.

The framework validates every key against the loaded rules and reports an
unknown rule id as an error.

## RuleConfig

The override one rule accepts.

| Declaration | Description |
|---|---|
| severity?: [Severity](./rule-definition.md#severity) | The severity applied to this rule. |
| options?: object | The rule's options, validated by the rule's own schema. |
| docs?: string | The path to the guideline shown for this rule. |

A `docs` value resolves from the project root, such as
`.vibator/docs/my-rule.md`, or from a package when prefixed with the package
name, such as `vibator:docs/rules/no-deprecated-apis.md`.

## Loading

How the framework finds and loads rules.

| Source | Loading |
|---|---|
| `.vibator/` folder | Every rule in the folder loads automatically. |
| `plugins` | Every module named in `plugins` loads from its path or package. |

Every loaded rule is configured by id in [rules](#rules). Each id stays unique
across the two sources, and the framework reports a repeated id as an error.
