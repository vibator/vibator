# From script to rule

This guide turns a check script into a vibator rule. The script checks that
every environment variable the code reads is listed in `.env.example`.

## The script

```js
// scripts/check-env-example.mjs
import { globSync, readFileSync } from "node:fs";

const documented = new Set(
  readFileSync(".env.example", "utf8")
    .split("\n")
    .map((line) => line.split("=")[0].trim()),
);

let failed = false;
for (const path of globSync("src/**/*.ts")) {
  const content = readFileSync(path, "utf8");
  for (const match of content.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
    if (!documented.has(match[1])) {
      console.error(`${path}: ${match[1]} is not in .env.example`);
      failed = true;
    }
  }
}
process.exit(failed ? 1 : 0);
```

It runs from an npm script such as
`"check:env": "node scripts/check-env-example.mjs"`.

## The rule

```ts
// .vibator/env-example.ts
import { defineRule, vibator } from "vibator";

export default defineRule({
  id: "env-example",
  title: "Every environment variable the code reads is in .env.example",
  check() {
    const example = vibator.project.files.get(`${vibator.project.root}/.env.example`);
    const documented = new Set(
      vibator.text.lines(example).map((line) => line.text.split("=")[0].trim()),
    );
    return vibator.text
      .search(vibator.project.files.match("src/**/*.ts"), /process\.env\.([A-Z0-9_]+)/)
      .filter((hit) => !documented.has(hit.groups[0]))
      .map((hit) => ({
        ...hit,
        message: `${hit.groups[0]} is read but not in .env.example`,
        expected: "Every variable the code reads has an entry in .env.example",
        fix: `Add ${hit.groups[0]}= to .env.example`,
      }));
  },
});
```

## What changed

| In the script                | In the rule                                     |
| ---------------------------- | ----------------------------------------------- |
| `globSync("src/**/*.ts")`    | `vibator.project.files.match("src/**/*.ts")`    |
| `readFileSync(path, "utf8")` | `vibator.text.lines(file)`, or `file.content`   |
| `content.matchAll(pattern)`  | `vibator.text.search(files, pattern)`           |
| `console.error(...)`         | A finding with `message`, `expected`, and `fix` |
| `process.exit(1)`            | The rule severity, `error` by default           |
| An npm script per check      | `npx vibator` for every rule                    |

The rule also gets the shared command line options. `--staged`, `--changed`,
and `--since` limit the files in `vibator.project.files`. `--reporter` selects
pretty, JSON, or SARIF output.

## Steps

1. Write the rule in `.vibator/`.
2. Run it alone with `npx vibator --only env-example` and compare its findings
   with the script output.
3. Delete the script, its npm script, and its CI step.

## Add a guideline

When the standard needs more than its title, point `docs` at a Markdown file.
`npx vibator explain env-example` prints it.

```ts
docs: ".vibator/docs/env-example.md",
```

```md
# env-example

Every environment variable the code reads through `process.env` has an entry in
`.env.example`. Contributors copy `.env.example` to `.env`, so a missing entry
leaves the variable unset.
```

## With a coding agent

The [`writing-vibator-rules` skill](05-agent-skills.md) teaches an agent the
rule shape and the namespace. With the skill installed, ask the agent to turn
each `scripts/check-*` file into a rule and to delete the script once the rule
reports the same findings.
