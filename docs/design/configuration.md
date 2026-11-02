# `.vibator.json`

This document is the reference of the `.vibator.json` configuration file: the
fields it accepts and the way the framework loads rules, as they are provided by
the base vibator framework.

A project adds a `.vibator.json` at its root. The file is optional and overrides
the default configuration.

## Reference

- [Fields](#fields): The top-level fields of the file.
- [extends](#extends): How a config inherits from base configs.
- [rules](#rules): Per-rule overrides.
- [RuleConfig](#ruleconfig): The override one rule accepts.
- [Loading](#loading): How the framework finds and loads rules.

---

## Fields

The top-level fields of the file.

| Declaration                                                                                     | Description                                                                                                |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| $schema?: string                                                                                | The path or URL of the schema that validates this file.                                                    |
| extends?: string\[]                                                                             | Paths or package names of base configs to inherit, applied in order.                                       |
| plugins?: string\[]                                                                             | Paths or package names of plugin modules. A plugin adds namespaces to `vibator`, registers rules, or both. |
| exclude?: string\[]                                                                             | Directory names to skip during file discovery, replacing the built-in defaults.                            |
| rules?: Record\<string, [Severity](./rule-definition.md#severity) \| [RuleConfig](#ruleconfig)> | Per-rule overrides, keyed by rule id.                                                                      |

## extends

A config inherits each base in `extends`, in order, then applies its own fields
on top. A base can extend other bases. A loop is an error.

| Field   | Merge                                                                                              |
| ------- | -------------------------------------------------------------------------------------------------- |
| $schema | Not inherited.                                                                                     |
| plugins | The base's plugins, then the config's own, each once. A base's plugins resolve from the base file. |
| exclude | The config's own list replaces the base's.                                                         |
| rules   | Merged by rule id. For a rule both set, the later severity wins and `options` merge by key.        |

A package base resolves through the package's `exports`, such as
`"extends": ["@acme/vibator-config/vibator.json"]`.

## rules

A rule entry is a [RuleConfig](#ruleconfig). A severity shorthand exists for
convenience: a bare [Severity](./rule-definition.md#severity) stands for that
severity alone, so `{ "no-conflict-markers": "off" }` reads as
`{ "no-conflict-markers": { "severity": "off" } }`.

The framework validates every key against the loaded rules and reports an
unknown rule id as an error.

## RuleConfig

The override one rule accepts.

| Declaration                                          | Description                                             |
| ---------------------------------------------------- | ------------------------------------------------------- |
| severity?: [Severity](./rule-definition.md#severity) | The severity applied to this rule.                      |
| options?: object                                     | The rule's options, validated by the rule's own schema. |

## Loading

How the framework finds and loads rules.

| Source             | Loading                                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.vibator/` folder | Every `.ts`, `.js`, and `.mjs` module at the top of the folder loads automatically. Tests, specs, declaration files, and subfolders are skipped, so helpers live in a subfolder. |
| `plugins`          | Every module named in `plugins` loads from its path or package, after `.vibator/`. Importing a plugin runs its `defineNamespace` and `defineRule` calls.                         |

Every loaded rule is configured by id in [rules](#rules). Each id stays unique
across the two sources, and the framework reports a repeated id as an error.
