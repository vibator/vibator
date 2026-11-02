---
name: configuring-vibator
description: "Tune .vibator.json: set rule severities and options, inherit a shared base config with extends, load plugins that add namespaces and rules, and exclude directories from discovery. Use when adjusting how a project's vibator rules run."
---

# Configuring vibator

`.vibator.json` at the project root is optional. Rules in `.vibator/` run
without it. The field reference is in
`node_modules/vibator/docs/design/configuration.md`, and
`node_modules/vibator/schema.json` validates the file.

## Fields

- `rules`: per-rule overrides, keyed by id. A value is a severity string
  (`"off"`, `"warn"`, `"error"`) or an object `{ severity, options }`.
- `extends`: paths or package names of base configs to inherit, in order. The
  project's own fields apply on top.
- `plugins`: paths or package names of plugin modules. A plugin adds namespaces
  to `vibator`, such as `vibator.i18n`, registers rules, or both.
- `exclude`: directory names to skip during file discovery.
- `$schema`: the schema that validates the file.

## Example

```json
{
  "$schema": "./node_modules/vibator/schema.json",
  "extends": ["@acme/vibator-config/vibator.json"],
  "plugins": ["@acme/vibator-i18n"],
  "rules": {
    "todo-has-ticket": "warn",
    "colors-from-tokens": { "options": { "tokens": "src/styles/tokens.css" } }
  }
}
```

## Rules

- A key under `rules` must name a loaded rule. An unknown id is an error.
- With `extends`, plugins add up, `exclude` replaces the base's list, and rules
  merge by id: the later severity wins and options merge by key.
- Override a base's rule in the project's own `rules`. Do not edit the base
  package.
- Turn a rule off with `"<id>": "off"`. Never turn a rule off to hide a real
  finding; fix the finding instead.
