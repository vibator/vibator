# vibator

A quality gate for coding agents. Configurable, glob-scoped rules over
JavaScript and TypeScript projects.

Read `docs/design/` before changing behavior. Those four files are the contract:
`vibator-namespace.md`, `rule-definition.md`, `configuration.md`,
`command-line.md`. Update the design doc in the same change as the code.

## Layout

```
src/
  namespace/      the `vibator` object a rule reads: project, ts, json, object,
                  text, ignore, git, shell, package, module. Plus runtime state
                  (root, excludes, scope) and discovery.
  rules/          defineRule and the registry, Rule/Report/Diagnostic/Severity,
                  the scope options fragment, the built-in rules.
  configuration/  .vibator.json types, the schema, and load (with extends).
  engine/         loadRules and run (the check → fix → check loop). Thin.
  cli/            argument parsing, subcommands, reporters. Calls the engine.
  cli.ts          the binary.
  index.ts        the public surface.
docs/design/      the reference docs.
scripts/          build tooling, run through package.json.
```

The public surface (`src/index.ts`) is the namespace, the rule surface, the
configuration types, and the engine. The CLI is the binary, not a library
export.

## Working on it

```sh
npx vitest run                        # the tests
npx tsc --noEmit -p tsconfig.json     # the types
npm run generate                      # regenerate schema.json from configSchema
```

Work test-first, one module at a time: write the test, run it red, write the
code, run it green. Every function gets a test unless it is a trivial re-export.

## Invariants

Do not undo these.

- The engine stays thin. Rules carry the work through the namespace; the engine
  loads rules and runs the check, fix, check loop, nothing more.
- Rules own traversal. A rule reads `vibator.project.files` and decides what to
  walk. The framework imposes no file selection.
- Paths in the namespace are absolute. Reporters relativize for display.
- `defineRule` registers into a map. A duplicate id is an error before any rule
  runs. Importing a rule module registers it.
- The three diagnostic fields stay separate: `message`, `expected`, `fix`.
- The namespace is the only I/O. A rule never touches `fs`, `git`, or the shell
  directly.

## Writing

Documentation, comments, commit messages, and user-facing strings use direct
language.

- Write plain declarative sentences. State the fact, then at most one sentence of
  why.
- No em-dashes. Use commas, colons, parentheses, periods.
- No rambling, aphorisms, or clever turns. No "X is what makes Y"; write the fact
  or "Y because X".
- No idioms or unusual verbs. Name things for what they are. No cute jargon.
- One fact per bullet. Paragraphs of one to three short sentences.
- Reference docs carry no essays. A one-line table entry is the documentation;
  add a section only when asked.
- TSDoc every function, private ones included, with complete `@param` and
  `@returns`. Module headers are one line; no explanatory paragraphs.
