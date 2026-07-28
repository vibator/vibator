# Contributing to vibator

Thanks for contributing. This document is for humans. Agents working in this
repository also follow [CLAUDE.md](./CLAUDE.md), and the design invariants
listed there bind all contributions. Participation is governed by the
[Code of Conduct](./CODE_OF_CONDUCT.md).

## Setup

```sh
npm install
npm run verify    # the whole gate: lint, arch, knip, build, test
```

`verify` runs the whole gate:

| Step            | Tool                         | Checks                                          |
|-----------------|------------------------------|-------------------------------------------------|
| `npm run lint`  | Biome (strict, `biome.json`) | Formatting, lint rules, complexity limits       |
| `npm run arch`  | dependency-cruiser           | Layer boundaries, cycles, dynamic `typescript`  |
| `npm run knip`  | knip                         | Dead code, unused exports and dependencies      |
| `npm run build` | tsc + generate               | Type errors, stale `schema.json`                |
| `npm run test`  | vitest                       | Unit tests, with coverage                       |

Requirements: Node 24 or later (see `.nvmrc`). Any package manager works, but
CI and the lockfile use npm. Node runs the TypeScript source directly through
type stripping, so there is no build step while developing. `npm run format`
applies Biome's formatting.

`schema.json` is generated from the configuration schema by the build. Commit
the regenerated file when you change the configuration schema. CI fails when it
is out of sync.

## Git hooks

`npm install` installs the hooks (husky):

- **pre-commit**: Biome on the staged files.
- **commit-msg**: commitlint. The commit type sets the release bump.
- **pre-push**: the full `npm run verify`.

## Commits

Conventional Commits, enforced locally and in CI. semantic-release cuts releases
from the commit history, so the type you choose is the version bump you cause:

- `fix:` patch, `feat:` minor, `feat!:` or `BREAKING CHANGE:` major.
- `docs:`, `chore:`, `test:`, `refactor:` produce no release.

Write the subject line for the changelog reader, not the diff reader.

## Changing behavior

The framework ships no rules. A rule lives in a project's `.vibator/` folder or
a plugin package, written against the `vibator` namespace, so rule authoring is
a task for consumers, not this repository. Contributions here change the
namespace, the rule surface, the configuration, the engine, or the CLI.

Read the design docs in [docs/design/](./docs/design/) before changing behavior.
Those four files are the contract. Here is a summary of the design choices:

- The engine is thin.
- Rules own traversal.
- The namespace is the only I/O.
- The three diagnostic fields are separate.
- `typescript` is an optional peer loaded with `await import`.

Update the design doc in the same change as the code, if it is needed.

## Style

- Biome owns formatting and lint.
- dependency-cruiser sets the layer boundaries:
  - `namespace` → imports no other src module
  - `rules` → imports only the `namespace`
  - `configuration` → reads the `namespace`
  - `engine` → imports `namespace`, `rules`, `configuration`
  - `cli` → the root; imports anything, nothing imports it
  - `typescript` → type-only or dynamic import
- knip keeps exports and dependencies in use or gone.

Documentation and user-visible strings (CLI output, rule messages, `fix` texts)
use plain, direct language.

If `npm run verify` passes, the style is right. Do not argue with a check in a
pull request; open an issue instead.

## Pull requests

Keep them scoped to one change. Fill in the template, including the local
verification checklist. CI runs the same `verify` chain plus commit linting. A
pull request merges with a green run and a review from a main contributor.
