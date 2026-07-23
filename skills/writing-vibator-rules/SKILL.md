---
name: writing-vibator-rules
description: "Author a custom vibator quality-gate rule: the rule contract, file vs project scope, diagnostics, options, guideline document, registration and tests. Use when adding a project-specific lint or guardrail, when a standard keeps coming up in code review and should be enforced automatically, or when asked to write, debug or publish a vibator rule or plugin."
---

# Writing a vibator rule

Reference: `npx vibator docs writing-rules` prints the full API and
`npx vibator docs configuration` the config format, wherever the package is
installed and whatever the package manager. Read the first before writing a
rule. This skill is the workflow; that document is the contract.

## Before writing anything

If the standard is pattern-shaped, do not write a rule at all. A forbidden
import, a banned call, a TODO without a ticket: anything a regular
expression over lines can express belongs in the built-in `banned-patterns`
rule's options, which takes the same three diagnostic fields in plain JSON.
Write code only for what needs context a pattern cannot see: types, scopes,
cross-file questions.

Check the rule is worth having. It must be:

- **Deterministic.** No clock, network or randomness.
- **Actionable.** You can state the fix in one line.
- **Low false positives.** A noisy rule gets switched off, and its true
  positives go with it. Ship as `warn` if unsure.
- **Not already covered.** Formatters own formatting, type checkers own
  types, dependency tools own import graphs. Write what they structurally
  cannot see.

If it fails any of these, say so rather than writing it. The best candidates
are standards that keep recurring in code review.

Run `npx vibator list` first; the rule may already exist.

## Where it goes

Project-specific rules go in a plugin directory (`vibator-rules/` by
convention), never inside the vibator package. Only add to
`vibator/src/rules/` if the rule would make sense in an unrelated
repository.

```
vibator-rules/
  package.json               {"type": "module"} if the repo root is not ESM
  my-rule.ts
  docs/
    my-rule.md
```

## Steps

1. **Write the rule.** Use `defineRule` from `vibator` so `options` is typed
   from your schema.

   ```ts
   import { defineRule } from "vibator";
   import { z } from "zod";

   export default defineRule({
     id: "my-rule",
     title: "One line, stated as the standard not the violation",
     docs: "my-rule.md",
     scope: "file",
     defaultSeverity: "error",
     defaultInclude: ["src/**/*.ts"],
     defaultExclude: ["**/*.test.ts"],
     optionsSchema: z.object({ limit: z.number().default(10) }),
     checkFile({ file, bytes, options, context }) {
       return [];
     },
   });
   ```

2. **Pick the scope.** Use `file` (implement `checkFile`) unless the
   question spans files, such as locale parity, codegen drift, or "exactly
   one module declares X". Then use `project` (implement `check`) and call
   `context.progress(done, total)` yourself.

3. **Write the diagnostics with three distinct fields.** This is the core of
   the tool; do not collapse them into one sentence.
   - `message`: what is wrong, present tense, no advice.
   - `expected`: the standard, stated positively.
   - `fix`: the concrete next action, usable without opening the guideline.

4. **Read through `context`, never `fs`.** `context.read`, `readBytes`,
   `memo` and `program` are memoized across the whole run.

5. **Write the guideline** at `docs/<id>.md`. Answer, in order: what the
   rule is, why it exists (name the concrete failure: what breaks, and
   where), what is expected, and when an exception is legitimate. A rule
   whose guideline cannot answer the second question is a preference, not a
   rule.

6. **Register it.**
   ```json
   {
     "plugins": ["./vibator-rules/my-rule.ts"],
     "rules": { "my-rule": { "severity": "error", "docs": "vibator-rules/docs/my-rule.md" } }
   }
   ```

7. **Test it against a planted violation and against the clean tree.** Both.
   ```sh
   npx vibator --only my-rule
   ```
   A rule that reports nothing on a clean repo has proved nothing. Plant a
   violation, confirm it fires with the right line, then remove it.

8. **Write unit tests.** Rules are pure functions; call them directly with a
   `Buffer`. Cover a violation, a non-violation, the exemption marker, and
   the edge case you were tempted to skip (empty file, no trailing newline,
   the pattern appearing inside a comment).

## TypeScript rules

Load `typescript` on demand (`await import("typescript")`), never at module
scope. It is an optional peer dependency.

Most questions are syntactic and need only `createSourceFile`. Use
`context.program(tsconfig)` only when you must resolve a symbol, overload or
type. It costs seconds rather than milliseconds, though the program is
shared with any other rule asking for the same tsconfig.

Two pitfalls:

- A symbol merges the docs of every overload. Resolve the signature at the
  call site instead.
- An object-literal key resolves to the literal's own property, which
  carries no documentation. Reach the declaration through the contextual
  type.

## Escape hatches

If the rule can be wrong, support a marked exception rather than forcing
people to disable it:

```ts
// vibator-ignore: <reason>
```

Take the marker as an option (`ignoreMarkers`) so a project can keep
whatever marker its source already uses. Require the reason; the bare marker
must not match. For line-based rules, use `hasLineIgnoreAbove` from the
`vibator` package instead of writing your own matcher.

## Common mistakes

- Scanning comments. If matching source text, strip comments first, or
  documentation that mentions the pattern is reported as a violation.
- Globbing without excluding tests, `.d.ts` or generated directories.
- Expecting `include` and `exclude` in config to merge with the defaults.
  They replace them.
- Reporting every occurrence in a file when the first is enough. Three
  hundred findings bury the useful one.
- Writing `fix` as a restatement of `message`.
