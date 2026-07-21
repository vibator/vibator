# Contributing to vibator

Thanks for considering it. This document is for humans; agents working in this
repository additionally follow [CLAUDE.md](./CLAUDE.md), and everything there
binds contributions too — the design invariants especially. Participation is
governed by the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Setup

```sh
npm install
npm run verify    # everything CI runs: lint, arch, knip, build, test, dogfood
```

`verify` is the whole gate in one command:

| Step               | Tool                        | Catches                                  |
|--------------------|-----------------------------|------------------------------------------|
| `npm run lint`     | Biome (strict, `biome.json`) | Format drift, lint errors, complexity    |
| `npm run arch`     | dependency-cruiser          | Layer violations, cycles, a static `typescript` import |
| `npm run knip`     | knip                        | Dead code, unused exports and dependencies |
| `npm run build`    | tsc + schema generator      | Type errors, a stale `schema.json`       |
| `npm run test`     | vitest                      | Everything with a regression test        |
| `node dist/cli.js` | vibator itself              | Its own rules, on its own source         |

Node ≥ 22 (see `.nvmrc`), any package manager — though CI and the lockfile use
npm. TypeScript source runs directly via Node's type stripping, so there is no
watch step: edit, run tests. `npm run format` applies Biome's formatting.

`npm install` also installs the git hooks (husky). They stage the cost where
it belongs:

- **pre-commit** — Biome over the staged files, plus vibator's fast rules
  (`--staged --only no-conflict-markers,max-file-size,max-lines,no-dead-doc-links`)
  over the same scope: hygiene in well under a second, so committing stays
  cheap. `max-file-size` in particular belongs here — pre-commit is the only
  cheap moment to keep an artifact out of history. The type-aware rules stay
  out; they cost real time and run on push.
- **commit-msg** — commitlint, because the commit type is the release bump.
- **pre-push** — the full `npm run verify`. Tests, build and the dogfood run
  happen once per push, not once per commit.

`schema.json` is generated from the rules' own zod schemas by the build —
commit the regenerated file whenever you touch a rule's options, or CI will
fail the sync check.

## Commits

Conventional Commits, enforced in CI. Releases are cut by semantic-release
from the commit history, so the type you choose is the version bump you cause:

- `fix:` → patch, `feat:` → minor, `feat!:`/`BREAKING CHANGE:` → major.
- `docs:`, `chore:`, `test:`, `refactor:` → no release.

Write the subject for the changelog reader, not the diff reader.

## What makes a rule worth shipping here

The bar for a built-in rule is higher than for a plugin: it must make sense in
a repository that is not yours. It must be deterministic, actionable in one
line, low on false positives, and not already covered by a formatter, type
checker or dead-code tool — vibator fills the holes those leave and does not
compete with them. Pattern-shaped standards belong in `banned-patterns`
options, not in new rules.

Read [docs/writing-rules.md](./docs/writing-rules.md) for the contract, and
mind the design invariants in [CLAUDE.md](./CLAUDE.md) — no baselines, three
separate diagnostic fields, reads through `context`, `typescript` stays an
optional peer loaded with `await import`.

Every rule ships with:

- a guideline in `docs/rules/<id>.md` that can answer "why is this a rule"
  with a concrete failure, not "consistency";
- tests covering a violation, a non-violation, the ignore marker if the rule
  has one, and the edge case you were tempted to skip;
- registration in `src/rules/index.ts`, ordered by cost;
- a row in the README's rules table.

## Style

Biome owns formatting and general lint (strict: cognitive complexity ≤ 8,
functions ≤ 25 lines, no stray `console`). dependency-cruiser owns the layer
boundaries (`core` knows no rule or reporter; `typescript` is only ever
imported type-only or dynamically). knip keeps exports and dependencies alive
or gone. On top of those, the repo enforces its own standards on itself via
`vibator.json` — TSDoc on every declaration, files under 400 lines, meaningful
names.

If `npm run verify` passes, the style is right; do not argue with a gate in a
PR, open an issue about the rule instead.

## Pull requests

Keep them scoped to one change. Fill in the template, including the local
verification checklist. CI runs the same `verify` chain plus commit linting; a
green run plus a review is what merges.
