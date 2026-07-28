---
name: configuring-vibator
description: "Set up or tune .vibator.json for a project: enable rules, set severities and options, add plugins, exclude directories, and inherit base configs with extends. Use when adding vibator to a project or adjusting its gates."
---

# Configuring vibator

`.vibator.json` at the project root is optional and overrides the defaults. Run
`npx vibator init` to write a starter file. It points `$schema` at
`node_modules/vibator/schema.json`, which validates the file and describes every
field. The field reference is in
`node_modules/vibator/docs/design/configuration.md`.

## Fields

- `rules` — per-rule overrides, keyed by id. A value is a severity string
  (`"off"`, `"warn"`, `"error"`) or an object `{ severity, options, docs }`.
- `plugins` — paths or package names of rule modules that live outside
  `.vibator/`.
- `exclude` — directory names to skip during file discovery.
- `extends` — paths or package names of base configs to inherit.
- `$schema` — the schema that validates the file.

## Example

```json
{
  "$schema": "./node_modules/vibator/schema.json",
  "extends": ["@acme/vibator-config"],
  "rules": {
    "no-deprecated-apis": "off",
    "meaningful-names": { "severity": "warn", "options": { "minLength": 3 } }
  }
}
```

## Rules

- A rule in `.vibator/` loads without being listed. Only outside rules go in
  `plugins`.
- Turn a rule off with `"<id>": "off"`. Never turn a rule off to hide a real
  finding; fix the finding instead.
- `extends` deep-merges: the child wins, arrays replace the base array, and a
  later base wins over an earlier one.
