# Getting started

## Install

Install vibator as a dev dependency. It requires Node 24 or later, or Bun 1.4.2
or later.

```sh
npm install --save-dev vibator
npx vibator init
```

With Bun:

```sh
bun add -d vibator
bunx --bun vibator init
bunx --bun vibator
```

`--bun` runs the binary on Bun. The binary has a `#!/usr/bin/env node` shebang,
so without the flag `bunx vibator` runs on Node whenever Node is installed. The
`npx vibator` commands in these guides become `bunx --bun vibator`.

`init` writes a starter rule, `.vibator/no-conflict-markers.ts`. It reports
lines left over from a merge conflict.

`typescript` is an optional peer dependency. The `ts` namespace uses the
project's own installation, version 5.4 up to 6.x.

## Write a rule

A rule is a module in `.vibator/` that calls `defineRule`. It reads the project
through the [`vibator` namespace](../design/vibator-namespace.md) and returns
its findings.

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

`text.search` returns every match across a set of files, each with its `file`,
`line`, and `column`. Spread a match into a finding and add the message.

`id`, `title`, and `check` are required. See the
[rule definition](../design/rule-definition.md) for the full shape.

## Run it

```sh
npx vibator                   # run every rule
npx vibator --write           # run each rule's fix, then check again
npx vibator list              # every rule, its severity, and its title
npx vibator explain <rule>    # the guideline behind a rule
npx vibator --only <ids>      # run only these rules
```

```text
src/components/card.css:11:23 error colors-from-tokens  Hardcoded color #f97316
```

## Test it

`runRule` from `vibator/testing` runs one rule against content you write in the
test. Each entry of `files` is a path and its text:

```ts
import { expect, it } from "vitest";
import { runRule } from "vibator/testing";
import rule from "../.vibator/colors-from-tokens.ts";

it("flags a hardcoded color", async () => {
  const findings = await runRule(rule, {
    files: { "src/card.css": "a { color: #fff; }" },
  });
  expect(findings.map((finding) => finding.message)).toEqual([
    "Hardcoded color #fff",
  ]);
});
```

`runRule` writes the entries into a temporary folder and deletes it after the
run, so the repository holds no broken files.

## Configure the rules

`.vibator.json` at the project root is optional. It sets the severity and the
options of each rule.

```json
{
  "rules": {
    "colors-from-tokens": "warn"
  }
}
```

See the [configuration reference](../design/configuration.md) for every field.

## Adopt on an existing codebase

To check only new work, limit the run to changed files:

```sh
npx vibator --since origin/main   # everything this branch changed
npx vibator --changed             # every uncommitted change
npx vibator --staged              # the files staged for the next commit
```
