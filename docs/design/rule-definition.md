# Rule definition

This document is the reference of the rule definition surface: the function
that declares a rule, the shape of a rule, and the types a rule returns, as
they are provided by the base vibator framework. A rule reaches files and
utilities through the [`vibator` namespace](./vibator-namespace.md).

## Reference

- [defineRule](#definerule): Declare a rule.
- [Rule](#rule): The shape of a rule.
- [Report](#report): The result of a rule execution.
- [Diagnostic](#diagnostic): One finding in a report.
- [Severity](#severity): The importance of a finding.
- [runRule](#runrule): Run a rule in a test.

---

## defineRule

Declare a rule.

| Declaration                                    | Description                                                  |
| ---------------------------------------------- | ------------------------------------------------------------ |
| defineRule(rule: [Rule](#rule)): [Rule](#rule) | Declares a rule and infers its options type from the schema. |

## Rule

The shape of a rule. `id`, `title`, and `check` are required; the rest carry
defaults.

| Declaration                                                                                                                              | Description                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| id: string                                                                                                                               | The stable kebab-case identifier, used as the config key.                                        |
| title: string                                                                                                                            | One line describing what the rule enforces.                                                      |
| docs?: string                                                                                                                            | The path to the guideline.                                                                       |
| severity?: [Severity](#severity)                                                                                                         | The default severity. The framework applies `"error"` by default.                                |
| options?: ZodType\<Options>                                                                                                              | The schema that validates and defaults the rule's config block.                                  |
| check(options: Options): [Report](#report) \| [Diagnostic](#diagnostic)\[] \| Promise<[Report](#report) \| [Diagnostic](#diagnostic)\[]> | Runs the rule across the files it chooses and returns a report, or the bare list of diagnostics. |
| fix?(options: Options, report: [Report](#report)): void \| Promise\<void>                                                                | Corrects the findings in a report. The framework calls it under `--write`.                       |

`Options` is the type inferred from the `options` schema. A rule that declares
no schema receives an empty options object.

A `docs` value resolves from the project root, such as
`.vibator/docs/my-rule.md`. A rule from a plugin passes an absolute path.

A rule that implements `fix` runs it only when `--write` is enabled. The
framework then drives that rule through a recheck loop, `check` → `fix` →
`check`, and reports whatever findings the final `check` leaves.

## Report

The result of a rule execution. One rule produces one report covering every
file it read.

| Declaration                               | Description                            |
| ----------------------------------------- | -------------------------------------- |
| diagnostics: [Diagnostic](#diagnostic)\[] | Every finding from the rule execution. |

## Diagnostic

One finding in a report.

| Declaration       | Description                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| file?: string     | The absolute path of the finding; reporters display it relative to the project root. Omit it for a whole-project finding. |
| line?: number     | The start line, or the single line where the finding is.                                                                  |
| endLine?: number  | The last line, when the finding spans several.                                                                            |
| column?: number   | The column where the finding starts.                                                                                      |
| message: string   | What the finding reports as wrong.                                                                                        |
| expected?: string | The standard the rule requires.                                                                                           |
| fix?: string      | The concrete next action that resolves it.                                                                                |

The framework keeps only these fields, so a rule can spread a richer value into
a diagnostic, such as a [Hit](./vibator-namespace.md#hit):
`{ ...hit, message: "..." }`.

## Severity

The importance the framework assigns a finding.

| Value   | Description                                    |
| ------- | ---------------------------------------------- |
| "error" | Fails the run.                                 |
| "warn"  | Reports the finding and keeps the run passing. |
| "off"   | Skips the rule.                                |

## runRule

Run one rule against a temporary project in a test. Import it from
`vibator/testing`.

| Declaration                                                               | Description                                                                                                                                     |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| runRule(rule: [Rule](#rule), fixture?: RuleFixture): Promise\<Finding\[]> | Writes the fixture files into a temporary folder, runs the rule, and returns its findings with root-relative paths and no snippet or guideline. |

| RuleFixture field               | Description                                                    |
| ------------------------------- | -------------------------------------------------------------- |
| files?: Record\<string, string> | The content of each project file, keyed by root-relative path. |
| options?: object                | The rule options, as `.vibator.json` passes them.              |

---

## External types

Types provided by other packages.

| Type    | Source                 |
| ------- | ---------------------- |
| ZodType | [zod](https://zod.dev) |
