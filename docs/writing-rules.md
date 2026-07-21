# Writing rules

The built-in rules are a starting set. Most projects have standards of their
own: a naming convention for one directory, a boundary a linter cannot see, a
file that must never import another. Those belong in a custom rule.

First check that you need one. A standard that a regular expression over
lines can express (a forbidden import, a banned call, a TODO without a
ticket) belongs in the built-in `banned-patterns` rule's options, in plain
JSON, with no code to maintain. Write a rule for what patterns cannot see:
types, scopes, cross-file questions.

This document is the whole authoring surface. For the config format, see
[configuration.md](./configuration.md).

---

## The shape of a rule

A rule is a plain object. Nothing is registered globally, nothing is
inherited, and there is no base class.

```ts
import { defineRule } from "vibator";
import { z } from "zod";

export default defineRule({
  id: "no-direct-env-access",
  title: "Configuration is read through the config module",
  docs: "no-direct-env-access.md",
  scope: "file",
  defaultSeverity: "error",
  defaultInclude: ["src/**/*.ts"],
  defaultExclude: ["src/config/**", "**/*.test.ts"],
  optionsSchema: z.object({
    module: z.string().default("src/config"),
  }),

  checkFile({ file, bytes, options }) {
    const lines = bytes.toString("utf8").split("\n");
    const index = lines.findIndex((line) => line.includes("process.env"));
    if (index === -1) return [];

    return [
      {
        file,
        line: index + 1,
        message: "Reads process.env directly",
        expected: `Configuration comes from ${options.module}`,
        fix: `Add the value to ${options.module} and import it from there`,
      },
    ];
  },
});
```

| Field             | Meaning                                                               |
|-------------------|-----------------------------------------------------------------------|
| `id`              | Kebab-case, unique. This is the config key and what `--only` matches. |
| `title`           | One line, shown in reports and `vibator list`.                        |
| `docs`            | Filename of the guideline, resolved against your rule pack's `docs/`. |
| `scope`           | `"file"` or `"project"`, see below.                                   |
| `defaultSeverity` | `"error"`, `"warn"` or `"off"` when config says nothing.              |
| `defaultInclude`  | Globs selecting the files the rule checks.                            |
| `defaultExclude`  | Globs removed from that selection. Optional.                          |
| `optionsSchema`   | A zod schema. Parsed from config and handed to your check.            |

`defineRule` is an identity function at runtime; it exists so `options` is
typed inside your check from the schema you declared.

---

## Two scopes

`scope: "file"`: implement `checkFile`, called once per selected file. The
engine iterates and reports progress for you.

```ts
checkFile({ file, bytes, options, context }): Diagnostic[]
```

`scope: "project"`: implement `check`, called once with every selected file.
Use it for questions no single file can answer: whether two locales agree,
whether generated output still matches its source, whether exactly one
module declares something. May be async.

```ts
check({ files, options, context }): Diagnostic[] | Promise<Diagnostic[]>
```

Project rules should call `context.progress(done, total)` themselves, or the
reporter has nothing to draw.

Prefer `file` scope. It is simpler and gets progress reporting for free.
Reach for `project` only when the question genuinely spans files.

---

## Diagnostics

The three message fields are the core of this tool. Keep them distinct.

```ts
{
  file: "src/api/client.ts",  // optional; omit for project-wide findings
  line: 42,                   // optional
  column: 8,                  // optional
  message: "Reads process.env directly",
  expected: "Configuration comes from src/config",
  fix: "Add the value to src/config and import it from there",
}
```

- `message`: what is wrong. Present tense, no advice.
- `expected`: the standard, stated positively. What the code should look
  like, not what it does.
- `fix`: the concrete next action. A person or a tool should be able to act
  on this line alone, without opening the guideline.

A consumer of `--reporter json` reads these as three fields. Do not collapse
them into one prose sentence.

Write `fix` as an instruction, not a diagnosis. "Split it into focused
modules" is actionable; "this file is too long" repeats `message`.

---

## The context

Every check receives a `context` of resources shared across the whole run.

| Member                                   | Use                                                                               |
|------------------------------------------|-----------------------------------------------------------------------------------|
| `context.root`                           | Absolute project root. All paths are relative to it.                              |
| `context.read(file)`                     | File as text, memoized for the run.                                               |
| `context.readBytes(file)`                | File as a `Buffer`, memoized.                                                     |
| `context.program(tsconfig)`              | A type-checked TypeScript program, memoized per tsconfig.                         |
| `context.memo(namespace, file, compute)` | Memoizes any per-file derivation (a parsed tree, an index) shared across rules.   |
| `context.git(args)`                      | Runs git from the root, returns trimmed stdout.                                   |
| `context.progress(done, total)`          | Drives the progress display.                                                      |

Always read through the context, never `fs` directly. Ten rules reading the
same file cost one read. This matters most for `context.program`: building a
TypeScript program is expensive, and several rules asking for the same
tsconfig share one type check.

---

## Working with TypeScript

`typescript` is an optional peer dependency. Load it on demand rather than
importing it at module scope, so a project using only text rules never has
to install it.

Most AST questions are syntactic (how long a name is, whether a doc comment
is present, what shape a call has) and need no type checker:

```ts
import type ts from "typescript";

async check({ files, context }) {
  const typescript = (await import("typescript")).default;

  return files.flatMap((file, index) => {
    const source = typescript.createSourceFile(
      file,
      context.read(file),
      typescript.ScriptTarget.Latest,
      true,
    );
    context.progress(index + 1, files.length);
    return walk(typescript, source, file);
  });
}
```

Only reach for `context.program(tsconfig)` when you need to resolve
something: what a symbol refers to, which overload a call selects, what type
an expression has. It costs seconds rather than milliseconds.

Two pitfalls, both found while building the built-in `no-deprecated-apis`:

- A symbol merges the documentation of every overload. Asking whether
  `querySelectorAll` is deprecated answers yes, on the strength of a
  deprecated overload nobody called. Resolve the signature at the call site
  instead (`checker.getResolvedSignature`).
- An object literal key resolves to the literal's own property, which
  carries no documentation. The declaration lives on the type the literal is
  assigned to; reach it through `checker.getContextualType`.

---

## Escape hatches

If your rule can be wrong, support a marked exception rather than forcing
people to disable it wholesale. The convention is a comment on the line
above, with a mandatory reason:

```ts
// vibator-ignore: hot path, runs per audio frame of a live call
for (let index = 0; index < input.length; index++) {
```

Accept the marker as an option so a project adopting your rule can keep
whatever marker its source already uses:

```ts
optionsSchema: z.object({
  ignoreMarkers: z.array(z.string()).default(["vibator-ignore"]),
})
```

The bare marker must not match; require the trailing reason.

For line-based rules, `hasLineIgnoreAbove(lines, lineNumber, markers)` from
the `vibator` package implements this convention (`//`, `#` and `<!--`
comment leaders, reason required), so plugins do not need their own variant.

---

## The guideline

Every rule ships a Markdown document explaining the standard. It is what
`vibator explain <rule>` prints and what each finding points at.

Put it next to your rules and name it in `docs`:

```
vibator-rules/
  no-direct-env-access.ts      docs: "no-direct-env-access.md"
  docs/
    no-direct-env-access.md
```

Write it for the person who just hit the rule and disagrees. A good
guideline answers four questions, in this order:

1. What the rule is, in one sentence.
2. Why it exists: the failure it prevents. Be concrete about what breaks and
   where.
3. What is expected, ideally with corrected code.
4. When an exception is legitimate, and how to mark it.

A rule whose guideline cannot answer the second question is usually a
preference, and preferences belong in a formatter.

---

## Registering

```json
{
  "plugins": [
    "./vibator-rules/no-direct-env-access.ts"
  ],
  "rules": {
    "no-direct-env-access": "error"
  }
}
```

`plugins` accepts repo-relative paths or package names. TypeScript files
work directly on Node 22.18+, which strips types natively.

A module may export one rule or an array of them:

```ts
export default [ruleOne, ruleTwo];
```

Rule ids must be unique across built-ins and plugins. A collision is an
error, not a silent override; otherwise the config would mean different
things depending on load order.

If your rules live in their own directory inside a repo that is not itself
an ES module, add a `package.json` there with `{"type": "module"}`.

---

## Testing

Rules are pure functions. Test them by calling them directly, without a
fixtures directory or runner integration.

```ts
import { createContext } from "vibator";
import rule from "./no-direct-env-access.ts";

const { context } = createContext(process.cwd());

const found = rule.checkFile({
  file: "src/a.ts",
  bytes: Buffer.from("const key = process.env.SECRET;\n"),
  options: { module: "src/config" },
  context,
});

expect(found).toHaveLength(1);
expect(found[0].line).toBe(1);
```

Test the boundary, not just the hit: the case that should pass is where
false positives get caught. For every rule, cover at least

- a clear violation,
- a clear non-violation,
- the exemption marker, if the rule has one,
- the edge case you were tempted to skip: an empty file, a file with no
  trailing newline, a comment containing the pattern you match.

---

## Publishing a rule pack

A rule pack is an ordinary npm package whose entry point default-exports an
array of rules and which ships its guidelines:

```json
{
  "name": "vibator-rules-acme",
  "type": "module",
  "main": "./dist/index.js",
  "files": ["dist", "docs"],
  "peerDependencies": { "vibator": "^0.1.0" }
}
```

Consumers then write `"plugins": ["vibator-rules-acme"]`.

---

## What makes a rule worth writing

Before writing one, check it clears these bars:

- **Deterministic.** Same input, same finding. No clock, no network, no
  randomness. A check that flickers gets disabled.
- **Actionable.** You can state the fix in one line. If you cannot, the
  problem is a design discussion, not a lint rule.
- **Low false positives.** A noisy rule gets switched off, and its true
  positives go with it. When in doubt, ship it as `warn` first.
- **Not already covered.** Formatters own formatting. Type checkers own
  types. Write the rule your other tools structurally cannot see.

The best candidates are the standards you find yourself repeating in code
review.
