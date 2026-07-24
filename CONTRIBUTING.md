# Contributing to vibator

Thanks for contributing. This document is for humans; agents working in this
repository additionally follow [CLAUDE.md](./CLAUDE.md), and the design
invariants listed there bind all contributions. Participation is governed by
the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Setup

```sh
npm install
npm run verify    # everything CI runs: lint, arch, knip, build, test, dogfood
```

`verify` runs the whole gate:

| Step               | Tool                         | Checks                                                |
|--------------------|------------------------------|-------------------------------------------------------|
| `npm run lint`     | Biome (strict, `biome.json`) | Formatting, lint rules, complexity limits             |
| `npm run arch`     | dependency-cruiser           | Layer boundaries, cycles, static `typescript` imports |
| `npm run knip`     | knip                         | Dead code, unused exports and dependencies            |
| `npm run build`    | tsc + generators             | Type errors, stale `schema.json` or rule catalog      |
| `npm run test`     | vitest                       | Unit tests, with coverage                             |
| `npm run vibator`  | vibator itself               | The repository's own rules, on its own source         |

Requirements: Node 22 or later (see `.nvmrc`). Any package manager works,
but CI and the lockfile use npm. TypeScript source runs directly through
Node's type stripping, so there is no watch step. `npm run format` applies
Biome's formatting.

`schema.json` and `docs/rule-catalog.md` are generated from the rules' own
zod schemas by the build. Commit the regenerated files whenever you touch a
rule's options; CI fails if they are out of sync.

## Git hooks

`npm install` installs the hooks (husky):

- **pre-commit**: Biome on staged files, plus vibator's fast rules
  (`--staged --only no-conflict-markers,max-file-size,no-dead-doc-links`)
  on the same scope. Runs in well under a second.
- **commit-msg**: commitlint, because the commit type determines the release
  bump.
- **pre-push**: the full `npm run verify`. Tests, build and the self-check
  run once per push rather than once per commit.

## Commits

Conventional Commits, enforced locally and in CI. Releases are cut by
semantic-release from the commit history, so the type you choose is the
version bump you cause:

- `fix:` patch, `feat:` minor, `feat!:` or `BREAKING CHANGE:` major.
- `docs:`, `chore:`, `test:`, `refactor:` produce no release.

Write the subject line for the changelog reader, not the diff reader.

## Adding a built-in rule

The bar for a built-in rule is higher than for a plugin: it must make sense
in a repository that is not yours. It must be deterministic, actionable in
one line, low on false positives, and not already covered by a formatter,
type checker or dead-code tool. Pattern-shaped standards belong in
`banned-patterns` options, not in new rules.

Read [docs/writing-rules.md](./docs/writing-rules.md) for the contract, and
the design invariants in [CLAUDE.md](./CLAUDE.md): no baselines, three
separate diagnostic fields, reads through `context`, `typescript` stays an
optional peer loaded with `await import`.

Every rule ships with:

- a guideline in `docs/rules/<id>.md` that answers "why is this a rule" with
  a concrete failure, not with "consistency";
- tests covering a violation, a non-violation, the ignore marker if the rule
  has one, and the edge case you were tempted to skip;
- registration in `src/rules/index.ts`, ordered by cost;
- a row in the README rules table.

## Style

- Biome owns formatting and general lint (cognitive complexity at most 8,
  functions at most 25 lines, no stray `console`).
- dependency-cruiser owns the layer boundaries: `core` knows no rule or
  reporter, and `typescript` is only imported type-only or dynamically.
- knip keeps exports and dependencies in use or gone.
- The repository checks itself with its own rules via `vibator.json`: TSDoc
  on every declaration, files under 400 lines, meaningful names.

Documentation and user-visible strings (CLI output, rule messages, `fix`
texts) use plain, direct language: short declarative sentences, no
em-dashes, no idioms, no marketing phrasing.

If `npm run verify` passes, the style is right. Do not argue with a check in
a pull request; open an issue about the rule instead.

## Pull requests

Keep them scoped to one change. Fill in the template, including the local
verification checklist. CI runs the same `verify` chain plus commit linting.
A pull request merges with a green run and a review.
