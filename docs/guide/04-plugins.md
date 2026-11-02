# Plugins and shared configuration

Rules in `.vibator/` belong to one repository. Plugins and base configs share
them across repositories.

- A plugin is a package that adds namespaces to `vibator`, registers rules, or
  both.
- A base config is a `.vibator.json` that other configs inherit with `extends`.

## Add a namespace

A namespace holds what several rules need to read. This one reads the
translation files under `locales/`.

```ts
// @acme/vibator-i18n/src/namespace.ts
import { defineNamespace, vibator } from "vibator";

export const i18n = defineNamespace("i18n", {
  /** The translation file of a locale. */
  file(locale: string) {
    return vibator.project.files.get(
      `${vibator.project.root}/locales/${locale}.json`,
    );
  },
  /** The dotted keys of a locale, such as `nav.home`. */
  keys(locale: string): string[] {
    return vibator.json.keys(vibator.json.parse(i18n.file(locale)));
  },
});

declare module "vibator" {
  interface Vibator {
    i18n: typeof i18n;
  }
}
```

`defineNamespace` adds `vibator.i18n` when the module is imported. A name that
`vibator` already has is an error. The `declare module` block gives rules the
type of `vibator.i18n`.

## Ship rules with it

A plugin can also register rules. This one compares two locales.

```ts
// @acme/vibator-i18n/src/rules/locales-match.ts
import { defineRule, vibator } from "vibator";
import "../namespace.ts";

export default defineRule({
  id: "locales-match",
  title: "Every locale has the keys of the English locale",
  check: () => {
    const french = new Set(vibator.i18n.keys("fr"));
    return vibator.i18n
      .keys("en")
      .filter((key) => !french.has(key))
      .map((key) => ({
        file: vibator.i18n.file("fr").path,
        message: `fr has no translation for ${key}`,
        fix: `Add ${key} to locales/fr.json`,
      }));
  },
});
```

The package entry imports both modules:

```ts
// @acme/vibator-i18n/src/index.ts
export { i18n } from "./namespace.ts";
import "./rules/locales-match.ts";
```

Publish the package as JavaScript with type declarations. Node does not run
TypeScript from `node_modules`.

## Load a plugin

A project loads the plugin in `.vibator.json`:

```json
{
  "plugins": ["@acme/vibator-i18n"]
}
```

vibator imports `.vibator/` first, then each plugin. The plugin's rules run with
the project's own, and the project's rules can read `vibator.i18n`:

```ts
// .vibator/no-empty-locale.ts
import type {} from "@acme/vibator-i18n";
import { defineRule, vibator } from "vibator";

export default defineRule({
  id: "no-empty-locale",
  title: "No locale file is empty",
  check: () =>
    ["en", "fr"]
      .filter((locale) => vibator.i18n.keys(locale).length === 0)
      .map((locale) => ({ message: `${locale} has no keys` })),
});
```

The `import type` line loads the plugin's type for `vibator.i18n`. It adds no
code at run time.

## Share a base config

A base config sets the plugins and the severities once for every repository.
Publish it in a package, such as `@acme/vibator-config/vibator.json`, and list
it in the package's `exports`:

```json
{
  "plugins": ["@acme/vibator-i18n"],
  "rules": { "locales-match": "error" }
}
```

A project extends it and overrides what differs:

```json
{
  "extends": ["@acme/vibator-config/vibator.json"],
  "rules": { "locales-match": "warn" }
}
```

```text
locales/fr.json warn locales-match  fr has no translation for nav.docs

0 error(s), 1 warning(s)
```

- Plugins add up: the base's first, then the project's, each once.
- Rules merge by id. The project's severity wins, and options merge by key.
- `exclude` from the project replaces the base's.

See the [configuration reference](../design/configuration.md#extends) for the
merge of each field, and the
[namespace reference](../design/vibator-namespace.md#extending-the-namespace)
for `defineNamespace`.
